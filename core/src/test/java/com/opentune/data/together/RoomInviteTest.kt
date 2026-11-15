package com.opentune.data.together

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RoomInviteTest {
    private val code = RoomCode.parse("K7QX-M2PA-9DTE")!!
    @Test fun newWebAndOldAppLinksBothOpenTheSameRoom() {
        assertEquals("https://music.blynx.vip/together/#code=${code.raw}", code.link)
        assertEquals(code, RoomCode.parse(code.link))
        assertEquals(code, RoomCode.parse("https://justshivv.github.io/Opentune/together/#code=${code.raw}"))
        assertEquals(code, RoomCode.parse("opentune://together/${code.raw}"))
        assertEquals(code, RoomCode.find("Listen with me\n${code.link}"))
        assertEquals(code, RoomCode.parse(code.appLink))
        assertEquals(code, RoomCode.find("Listen with me\n${code.appLink}"))
        assertEquals(code, RoomCode.parse("k7qx m2pa 9dte"))
    }
    @Test fun refusesUnrelatedHostsPathsAndPartialCodes() {
        assertNull(RoomCode.parse("https://evil.test/together/${code.raw}"))
        assertNull(RoomCode.parse("https://justshivv.github.io.evil.test/Opentune/together/#code=${code.raw}"))
        assertNull(RoomCode.parse("https://justshivv.github.io/Other/together/#code=${code.raw}"))
        assertNull(RoomCode.parse("${code.appLink}AAAA"))
        assertNull(RoomCode.parse("https://justshivv.github.io/Opentune/together/"))
    }
}
