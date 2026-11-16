package com.opentune.data.library

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec
import kotlinx.serialization.Serializable

/** Versioned, salted verifier. The playlist password itself is never persisted. */
@Serializable
internal data class PlaylistPassword(
    val salt: String,
    val verifier: String,
    val iterations: Int,
) {
    fun matches(password: CharArray): Boolean {
        val expected = Base64.getDecoder().decode(verifier)
        val actual = derive(password, Base64.getDecoder().decode(salt), iterations)
        return try {
            MessageDigest.isEqual(expected, actual)
        } finally {
            actual.fill(0)
        }
    }

    companion object {
        private const val ITERATIONS = 600_000

        fun create(password: CharArray): PlaylistPassword {
            val salt = ByteArray(16).also(SecureRandom()::nextBytes)
            val derived = derive(password, salt, ITERATIONS)
            val encoder = Base64.getEncoder()
            return try {
                PlaylistPassword(encoder.encodeToString(salt), encoder.encodeToString(derived), ITERATIONS)
            } finally {
                derived.fill(0)
            }
        }

        private fun derive(password: CharArray, salt: ByteArray, iterations: Int): ByteArray {
            val spec = PBEKeySpec(password, salt, iterations, 256)
            return try {
                SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
            } finally {
                spec.clearPassword()
            }
        }
    }
}
