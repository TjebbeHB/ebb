package expo.modules.ebblocalai

import java.io.File
import java.security.MessageDigest
import java.util.concurrent.CancellationException

internal object FileHash {
  fun sha256(file: File, cancelled: () -> Boolean, progress: (Long) -> Unit): String {
    val digest = MessageDigest.getInstance("SHA-256")
    val buffer = ByteArray(1024 * 1024)
    var bytes = 0L
    file.inputStream().buffered(buffer.size).use { input ->
      while (true) {
        if (cancelled()) throw CancellationException("Verification stopped.")
        val count = input.read(buffer)
        if (count < 0) break
        digest.update(buffer, 0, count)
        bytes += count
        if (bytes % (16 * 1024 * 1024) == 0L) progress(bytes)
      }
    }
    if (cancelled()) throw CancellationException("Verification stopped.")
    progress(bytes)
    return digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
  }
}
