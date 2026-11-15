package com.opentune.ui.components

import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.vector.PathParser

internal const val MARK_VIEWPORT = 108f
internal const val MARK_PATH_DATA =
    "M54,25 A29,29 0,1 0,54 83 A29,29 0,1 0,54 25 Z " +
        "M54,31 A23,23 0,1 1,54 77 A23,23 0,1 1,54 31 Z " +
        "M48,42 Q46,41 46,44 L46,64 Q46,67 49,65 L66,55 Q68,54 66,52 Z"

internal fun markPath(): Path = PathParser().parsePathString(MARK_PATH_DATA).toPath().apply {
    fillType = PathFillType.EvenOdd
}
