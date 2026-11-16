package com.opentune.data.library

import com.opentune.data.RemotePlaylist
import com.opentune.data.model.PlaylistPrivacy
import com.opentune.data.model.Song
import kotlinx.serialization.json.Json
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PlaylistLockTest {
    @After fun resetLibrary() {
        LibraryStore.importJson(Json.parseToJsonElement("{}"))
    }

    @Test fun playlistOnlySkipsRemoteChangesButAllowsLocalAdds() {
        val id = LibraryStore.createPlaylist("My playlist", song("first"))
        LibraryStore.link(id, "remote", "other-account")
        LibraryStore.setPlaylistOnly(id, true)
        val remote = RemotePlaylist("Renamed remotely", PlaylistPrivacy.PRIVATE, listOf(song("remote")))

        LibraryStore.applyRemote(id, remote)
        assertEquals("My playlist", LibraryStore.playlist(id)?.name)
        assertEquals(listOf("first"), LibraryStore.playlist(id)?.songs?.map { it.videoId })
        // Unlink before editing to keep this test independent of remote request dispatch.
        LibraryStore.keepLinksFor("account")
        LibraryStore.addToPlaylist(id, song("second"))

        assertTrue(LibraryStore.playlist(id)?.playlistOnly == true)
        assertEquals(listOf("first", "second"), LibraryStore.playlist(id)?.songs?.map { it.videoId })
    }

    @Test fun passwordVerifierRejectsWrongPasswordAndUsesUniqueSalts() {
        val password = "a strong playlist password".toCharArray()
        val first = PlaylistPassword.create(password)
        val second = PlaylistPassword.create(password)
        assertNotEquals(first.salt, second.salt)
        assertNotEquals(first.verifier, second.verifier)
        assertTrue(first.matches(password))
        assertFalse(first.matches("wrong password".toCharArray()))
    }

    private fun song(id: String) = Song(id, "Song $id", "Artist", null)
}
