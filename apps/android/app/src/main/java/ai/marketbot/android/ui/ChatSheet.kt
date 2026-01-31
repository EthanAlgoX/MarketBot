package ai.marketbot.android.ui

import androidx.compose.runtime.Composable
import ai.marketbot.android.MainViewModel
import ai.marketbot.android.ui.chat.ChatSheetContent

@Composable
fun ChatSheet(viewModel: MainViewModel) {
  ChatSheetContent(viewModel = viewModel)
}
