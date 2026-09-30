import CryptoKit
import ExpoModulesCore
import Foundation

public class EbbLocalAiModule: Module {
  private let hashQueue = DispatchQueue(label: "app.ebb.file-hash", qos: .utility)
  private let hashLock = NSLock()
  private var hashCancelled = false
  private var hashing = false

  public func definition() -> ModuleDefinition {
    Name("EbbLocalAi")
    Events("onHashProgress", "onAnalysisProgress")
    AsyncFunction("isInferenceAvailable") { false }
    AsyncFunction("cancelMealAnalysis") { }
    AsyncFunction("getStorageDirectory") { (kind: String) -> String in
      try self.storageDirectory(kind).absoluteString
    }
    AsyncFunction("getModelDirectory") { () -> String in
      try self.storageDirectory("models").absoluteString
    }
    AsyncFunction("statFile") { (uri: String) -> [String: Any]? in
      let url = try self.privateURL(uri)
      guard FileManager.default.fileExists(atPath: url.path) else { return nil }
      let values = try url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey, .isDirectoryKey])
      return ["size": values.fileSize ?? 0, "modifiedAt": (values.contentModificationDate?.timeIntervalSince1970 ?? 0) * 1000, "isDirectory": values.isDirectory ?? false]
    }
    AsyncFunction("readTextFile") { (uri: String) -> String? in
      let url = try self.privateURL(uri)
      guard FileManager.default.fileExists(atPath: url.path) else { return nil }
      let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
      guard size <= 1024 * 1024 else { throw self.error("Receipt is too large.") }
      return try String(contentsOf: url, encoding: .utf8)
    }
    AsyncFunction("writeTextFile") { (uri: String, text: String) in
      guard text.utf8.count <= 1024 * 1024 else { throw self.error("Receipt is too large.") }
      let url = try self.privateURL(uri)
      try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
      try text.write(to: url, atomically: true, encoding: .utf8)
    }
    AsyncFunction("moveFile") { (from: String, to: String) in
      let source = try self.privateURL(from)
      let target = try self.privateURL(to)
      try FileManager.default.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
      // rename atomically replaces a receipt/model on the app's single storage volume.
      if rename(source.path, target.path) != 0 { throw self.error("The private file could not be moved.") }
    }
    AsyncFunction("copyFile") { (from: String, to: String) in
      let source = try self.privateURL(from)
      let target = try self.privateURL(to)
      try FileManager.default.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
      if FileManager.default.fileExists(atPath: target.path) { try FileManager.default.removeItem(at: target) }
      try FileManager.default.copyItem(at: source, to: target)
    }
    AsyncFunction("removeFile") { (uri: String) in
      let url = try self.privateURL(uri)
      if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
    }
    AsyncFunction("listDirectory") { (uri: String) -> [String] in
      let url = try self.privateURL(uri)
      guard FileManager.default.fileExists(atPath: url.path) else { return [] }
      return try FileManager.default.contentsOfDirectory(atPath: url.path)
    }
    AsyncFunction("hashFile") { (uri: String, promise: Promise) in
      self.hashLock.lock()
      if self.hashing {
        self.hashLock.unlock()
        promise.reject("E_HASH_BUSY", "Another model is being verified.")
        return
      }
      self.hashing = true
      self.hashCancelled = false
      self.hashLock.unlock()
      self.hashQueue.async {
        var result: String?
        var failed = false
        var wasCancelled = false
        defer {
          self.hashLock.lock()
          self.hashing = false
          self.hashLock.unlock()
          if failed { promise.reject(wasCancelled ? "E_CANCELLED" : "E_HASH", wasCancelled ? "Verification stopped." : "Could not verify the model file.") }
          else { promise.resolve(result) }
        }
        do {
          let url = try self.privateURL(uri)
          let handle = try FileHandle(forReadingFrom: url)
          defer { try? handle.close() }
          var digest = SHA256()
          var processed = 0
          while true {
            if self.isHashCancelled() { throw self.error("Verification stopped.") }
            // Drain Foundation's temporary NSData objects per chunk for multi-GB models.
            let count = try autoreleasepool { () throws -> Int in
              let data = try handle.read(upToCount: 1024 * 1024) ?? Data()
              if !data.isEmpty { digest.update(data: data) }
              return data.count
            }
            if count == 0 { break }
            processed += count
            if processed % (16 * 1024 * 1024) == 0 {
              self.sendEvent("onHashProgress", ["uri": uri, "bytes": processed])
            }
          }
          if self.isHashCancelled() { throw self.error("Verification stopped.") }
          self.sendEvent("onHashProgress", ["uri": uri, "bytes": processed])
          result = digest.finalize().map { String(format: "%02x", $0) }.joined()
        } catch {
          failed = true
          wasCancelled = self.isHashCancelled()
        }
      }
    }
    AsyncFunction("cancelHash") { self.stopHash() }
    OnDestroy { self.stopHash() }
  }

  private func error(_ message: String) -> NSError {
    NSError(domain: "EbbLocalAi", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }

  private func storageDirectory(_ kind: String) throws -> URL {
    guard kind == "models" || kind == "photos" else { throw error("Unknown private directory.") }
    let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    var root = support.appendingPathComponent("EbbLocalAi", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    var options = URLResourceValues()
    options.isExcludedFromBackup = true
    try root.setResourceValues(options)
    var directory = root.appendingPathComponent("ebb-food-\(kind)", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    try directory.setResourceValues(options)
    return directory
  }

  private func privateURL(_ value: String) throws -> URL {
    let url: URL
    if value.hasPrefix("/") { url = URL(fileURLWithPath: value) }
    else if let parsed = URL(string: value), parsed.isFileURL { url = parsed }
    else { throw error("Expected a private file URI.") }
    let resolved = url.resolvingSymlinksInPath().standardizedFileURL
    let paths: [FileManager.SearchPathDirectory] = [.documentDirectory, .cachesDirectory, .applicationSupportDirectory]
    var roots = paths.compactMap { FileManager.default.urls(for: $0, in: .userDomainMask).first }
    roots.append(FileManager.default.temporaryDirectory)
    guard roots.contains(where: { resolved.path.hasPrefix($0.resolvingSymlinksInPath().standardizedFileURL.path + "/") }) else {
      throw error("File must be inside app-private storage.")
    }
    return resolved
  }

  private func stopHash() { hashLock.lock(); hashCancelled = true; hashLock.unlock() }
  private func isHashCancelled() -> Bool { hashLock.lock(); defer { hashLock.unlock() }; return hashCancelled }
}
