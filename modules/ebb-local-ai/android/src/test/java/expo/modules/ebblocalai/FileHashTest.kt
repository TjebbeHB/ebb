package expo.modules.ebblocalai

import java.io.File
import java.security.MessageDigest
import java.util.concurrent.CancellationException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FileHashTest {
  @Test fun hashesAcrossChunkBoundariesWithoutLoadingWholeFile() {
    val file = File.createTempFile("ebb-hash", ".bin")
    try {
      val data = ByteArray(2 * 1024 * 1024 + 43) { (it % 253).toByte() }
      file.writeBytes(data)
      val expected = MessageDigest.getInstance("SHA-256").digest(data).joinToString("") { "%02x".format(it.toInt() and 0xff) }
      var processed = 0L
      assertEquals(expected, FileHash.sha256(file, { false }) { processed = it })
      assertEquals(file.length(), processed)
    } finally { file.delete() }
  }

  @Test fun cancellationLeavesSourceIntact() {
    val file = File.createTempFile("ebb-hash", ".bin")
    try {
      file.writeText("abc")
      try {
        FileHash.sha256(file, { true }) { }
        throw AssertionError("Expected cancellation")
      } catch (_: CancellationException) { }
      assertTrue(file.isFile)
      assertEquals("abc", file.readText())
    } finally { file.delete() }
  }
}
