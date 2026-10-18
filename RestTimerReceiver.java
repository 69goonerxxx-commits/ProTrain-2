package com.program.protrain;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

// Handles the notification buttons (+30 s, Skip rest) and the alarm that fires when the rest ends.
public class RestTimerReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    if (intent == null || intent.getAction() == null) return;
    String a = intent.getAction();
    if (RestTimerCore.ACT_ADD.equals(a)) RestTimerCore.addTime(context, 30000L);
    else if (RestTimerCore.ACT_SKIP.equals(a)) RestTimerCore.skip(context);
    else if (RestTimerCore.ACT_DONE.equals(a)) RestTimerCore.finish(context);
  }
}
