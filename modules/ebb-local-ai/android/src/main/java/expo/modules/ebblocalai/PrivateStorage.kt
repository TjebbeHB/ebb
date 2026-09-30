package expo.modules.ebblocalai

import android.content.Context
import android.net.Uri
import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption

/** Small receipts and file operations that Expo's legacy FS does not permit in noBackupFilesDir. */
internal class PrivateStorage(private val context: Context) {
  private fun file(value: String): File {
    val uri = Uri.parse(value)
    require(uri.scheme == "file" || uri.scheme == null) { "Expected a private file URI." }
    val result = File(if (uri.scheme == "file") requireNotNull(uri.path) else value).canonicalFile
    val roots = listOf(context.filesDir, context.cacheDir, context.noBackupFilesDir).map { it.canonicalPath + "/" }
    require(roots.any { result.path.startsWith(it) }) { "File must be inside app-private storage." }
    return result
  }

  fun stat(uri: String): Map<String, Any>? {
    val value = file(uri)
    if (!value.exists()) return null
    return mapOf("size" to value.length().toDouble(), "modifiedAt" to value.lastModified().toDouble(), "isDirectory" to value.isDirectory)
  }

  fun readText(uri: String): String? {
    val value = file(uri)
    if (!value.exists()) return null
    require(value.isFile && value.length() <= 1024 * 1024) { "Receipt is too large." }
    return value.readText(Charsets.UTF_8)
  }

  fun writeText(uri: String, text: String) {
    require(text.toByteArray(Charsets.UTF_8).size <= 1024 * 1024) { "Receipt is too large." }
    val target = file(uri)
    check(target.parentFile?.let { it.isDirectory || it.mkdirs() } == true) { "Private directory is unavailable." }
    val temporary = File.createTempFile(".receipt-", ".tmp", target.parentFile)
    try {
      temporary.outputStream().use { output ->
        output.write(text.toByteArray(Charsets.UTF_8))
        output.fd.sync()
      }
      Files.move(temporary.toPath(), target.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
    } finally { temporary.delete() }
  }

  fun move(from: String, to: String) {
    val source = file(from)
    val target = file(to)
    require(source.isFile) { "The source file is missing." }
    check(target.parentFile?.let { it.isDirectory || it.mkdirs() } == true)
    Files.move(source.toPath(), target.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
  }

  fun copy(from: String, to: String) {
    val source = file(from)
    val target = file(to)
    require(source.isFile) { "The source file is missing." }
    check(target.parentFile?.let { it.isDirectory || it.mkdirs() } == true)
    Files.copy(source.toPath(), target.toPath(), StandardCopyOption.REPLACE_EXISTING)
  }

  fun remove(uri: String) {
    val value = file(uri)
    if (value.exists()) check(value.deleteRecursively()) { "The private file could not be removed." }
  }

  fun list(uri: String): List<String> {
    val directory = file(uri)
    if (!directory.exists()) return emptyList()
    require(directory.isDirectory)
    return requireNotNull(directory.list()).toList()
  }
}
