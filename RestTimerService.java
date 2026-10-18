package com.program.protrain;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

// Short-lived foreground service: lives only while a rest is counting down, and redraws the notification once a
// second so its progress bar shrinks. It stops itself the moment the rest ends, is skipped or is cleared.
public class RestTimerService extends Service {
  private final Handler handler = new Handler(Looper.getMainLooper());
  private final Runnable tick = new Runnable() {
    @Override
    public void run() {
      Notification n = RestTimerCore.buildLive(RestTimerService.this);
      if (n == null) {
        stopNow();
        return;
      }
      NotificationManager m = RestTimerCore.nm(RestTimerService.this);
      if (m != null) m.notify(RestTimerCore.ID_LIVE, n);
      handler.postDelayed(this, 1000);
    }
  };

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    RestTimerCore.prefs(this).edit().putBoolean("svc", true).apply();
    Notification n = RestTimerCore.buildLive(this);
    boolean empty = n == null;
    if (empty) n = RestTimerCore.placeholder(this);
    try {
      if (Build.VERSION.SDK_INT >= 34) {
        startForeground(RestTimerCore.ID_LIVE, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
      } else {
        startForeground(RestTimerCore.ID_LIVE, n);
      }
    } catch (Throwable t) {
      // Android refused the foreground service: the plain notification (no shrinking bar) still shows
      RestTimerCore.prefs(this).edit().putBoolean("svc", false).apply();
      stopSelf();
      return START_NOT_STICKY;
    }
    handler.removeCallbacks(tick);
    if (empty) {
      stopNow();
    } else {
      handler.postDelayed(tick, 1000);
    }
    return START_NOT_STICKY;
  }

  private void stopNow() {
    handler.removeCallbacks(tick);
    if (Build.VERSION.SDK_INT >= 24) stopForeground(Service.STOP_FOREGROUND_REMOVE);
    else stopForeground(true);
    stopSelf();
  }

  @Override
  public void onDestroy() {
    handler.removeCallbacks(tick);
    RestTimerCore.prefs(this).edit().putBoolean("svc", false).apply();
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }
}
