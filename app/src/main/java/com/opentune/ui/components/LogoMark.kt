package com.opentune.ui.components

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.vector.PathParser

internal const val MARK_VIEWPORT = 108f
internal val BlynxPlum = Color(0xFF301623)
internal val BlynxCitron = Color(0xFFF4F5AA)
internal const val MARK_PATH_DATA =
    "M25,29 L43,39 Q54,35 65,39 L83,29 L79,61 Q77,69 68,73 L54,80 L40,73 Q31,69 29,61 Z " +
        "M47,47 Q46,46 46,48 L46,66 Q46,68 48,67 L64,58 Q66,57 64,56 Z"

internal fun markPath(): Path = PathParser().parsePathString(MARK_PATH_DATA).toPath().apply {
    fillType = PathFillType.EvenOdd
}
