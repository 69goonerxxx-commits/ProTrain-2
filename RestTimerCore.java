package com.program.protrain;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.text.format.DateFormat;
import androidx.core.app.NotificationCompat;
import java.util.Date;

// Everything the rest-timer notification does. State lives in SharedPreferences so the +30 s / Skip buttons
// and the end-of-rest alarm keep working even when the app process is not running.
final class RestTimerCore {
  static final String PREFS = "protrain_rest";
  static final String CH_LIVE = "rest_live";
  static final String CH_DONE = "rest_done";
  static final int ID_LIVE = 4301;
  static final int ID_DONE = 4302;
  static final String ACT_ADD = "com.program.protrain.REST_ADD";
  static final String ACT_SKIP = "com.program.protrain.REST_SKIP";
  static final String ACT_DONE = "com.program.protrain.REST_DONE";
  static final int ORANGE = 0xFFF5A623;

  private RestTimerCore() {}

  static SharedPreferences prefs(Context c) {
    return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }

  static NotificationManager nm(Context c) {
    return (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
  }

  static void ensureChannels(Context c) {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager m = nm(c);
    if (m == null) return;
    NotificationChannel live = new NotificationChannel(CH_LIVE, "Rest timer", NotificationManager.IMPORTANCE_LOW);
    live.setDescription("Shows your rest countdown while you are outside the app");
    live.setShowBadge(false);
    live.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    m.createNotificationChannel(live);
    NotificationChannel done = new NotificationChannel(CH_DONE, "Rest complete", NotificationManager.IMPORTANCE_HIGH);
    done.setDescription("Alerts you when your rest ends");
    done.enableVibration(true);
    done.setVibrationPattern(new long[] {0, 400, 100, 400, 100, 400});
    m.createNotificationChannel(done);
  }

  static int pendingFlags() {
    return PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
  }

  static PendingIntent broadcast(Context c, String action, int requestCode) {
    Intent i = new Intent(c, RestTimerReceiver.class);
    i.setAction(action);
    return PendingIntent.getBroadcast(c, requestCode, i, pendingFlags());
  }

  static PendingIntent openApp(Context c) {
    Intent i = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
    if (i == null) return null;
    return PendingIntent.getActivity(c, 0, i, pendingFlags());
  }

  static int smallIcon(Context c) {
    int id = c.getResources().getIdentifier("ic_stat_protrain", "drawable", c.getPackageName());
    return id != 0 ? id : c.getApplicationInfo().icon;
  }

  // the real app icon (what the launcher shows), drawn into a bitmap for the notification's large icon
  static Bitmap logo(Context c) {
    try {
      Drawable d = c.getPackageManager().getApplicationIcon(c.getPackageName());
      int size = 192;
      Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
      Canvas canvas = new Canvas(bmp);
      d.setBounds(0, 0, size, size);
      d.draw(canvas);
      return bmp;
    } catch (Throwable t) {
      return null;
    }
  }

  static String clock(Context c, long ms) {
    return DateFormat.getTimeFormat(c).format(new Date(ms));
  }

  static void start(Context c, long end, long total, String title, String prefix, String nextLabel, String doneTitle, String doneText) {
    prefs(c).edit()
        .putBoolean("active", true).putBoolean("skipped", false).putBoolean("finished", false)
        .putLong("end", end).putLong("total", total)
        .putString("title", title).putString("prefix", prefix).putString("nextLabel", nextLabel)
        .putString("doneTitle", doneTitle).putString("doneText", doneText)
        .apply();
    showLive(c);
    scheduleDone(c, end);
  }

  static void addTime(Context c, long ms) {
    SharedPreferences p = prefs(c);
    if (!p.getBoolean("active", false)) return;
    long end = p.getLong("end", 0) + ms;
    p.edit().putLong("end", end).putLong("total", p.getLong("total", 0) + ms).apply();
    showLive(c);
    scheduleDone(c, end);
  }

  static void skip(Context c) {
    prefs(c).edit().putBoolean("active", false).putBoolean("skipped", true).apply();
    cancelLive(c);
    cancelAlarm(c);
  }

  static void finish(Context c) {
    SharedPreferences p = prefs(c);
    if (!p.getBoolean("active", false)) return;
    p.edit().putBoolean("active", false).putBoolean("finished", true).apply();
    cancelLive(c);
    showDone(c);
  }

  static void clear(Context c) {
    prefs(c).edit().putBoolean("active", false).putBoolean("skipped", false).putBoolean("finished", false).apply();
    cancelLive(c);
    cancelAlarm(c);
    NotificationManager m = nm(c);
    if (m != null) m.cancel(ID_DONE);
  }

  static void cancelLive(Context c) {
    NotificationManager m = nm(c);
    if (m != null) m.cancel(ID_LIVE);
  }

  static void showLive(Context c) {
    SharedPreferences p = prefs(c);
    long end = p.getLong("end", 0);
    long left = end - System.currentTimeMillis();
    if (!p.getBoolean("active", false) || left <= 0) {
      cancelLive(c);
      return;
    }
    NotificationManager m = nm(c);
    if (m == null) return;
    ensureChannels(c);
    String prefix = p.getString("prefix", "");
    String text = (prefix.isEmpty() ? "" : prefix + ". ") + p.getString("nextLabel", "Next set at") + " " + clock(c, end);
    NotificationCompat.Builder b = new NotificationCompat.Builder(c, CH_LIVE)
        .setSmallIcon(smallIcon(c))
        .setColor(ORANGE)
        .setContentTitle(p.getString("title", "Rest"))
        .setContentText(text)
        .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setWhen(end)
        .setShowWhen(true)
        .setUsesChronometer(true)
        .setChronometerCountDown(true)
        .setTimeoutAfter(left + 3000)
        .addAction(0, "+30 s", broadcast(c, ACT_ADD, 1))
        .addAction(0, "Skip rest", broadcast(c, ACT_SKIP, 2));
    Bitmap logo = logo(c);
    if (logo != null) b.setLargeIcon(logo);
    PendingIntent open = openApp(c);
    if (open != null) b.setContentIntent(open);
    m.notify(ID_LIVE, b.build());
  }

  static void showDone(Context c) {
    SharedPreferences p = prefs(c);
    NotificationManager m = nm(c);
    if (m == null) return;
    ensureChannels(c);
    NotificationCompat.Builder b = new NotificationCompat.Builder(c, CH_DONE)
        .setSmallIcon(smallIcon(c))
        .setColor(ORANGE)
        .setContentTitle(p.getString("doneTitle", "Rest complete"))
        .setContentText(p.getString("doneText", "Time for your next set."))
        .setAutoCancel(true)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setCategory(NotificationCompat.CATEGORY_REMINDER)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setVibrate(new long[] {0, 400, 100, 400, 100, 400})
        .setDefaults(NotificationCompat.DEFAULT_SOUND)
        .setTimeoutAfter(180000);
    Bitmap logo = logo(c);
    if (logo != null) b.setLargeIcon(logo);
    PendingIntent open = openApp(c);
    if (open != null) b.setContentIntent(open);
    m.notify(ID_DONE, b.build());
  }

  static void scheduleDone(Context c, long end) {
    AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
    if (am == null) return;
    PendingIntent pi = broadcast(c, ACT_DONE, 3);
    try {
      if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, end, pi);
      } else {
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, end, pi);
      }
    } catch (SecurityException e) {
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, end, pi);
    }
  }

  static void cancelAlarm(Context c) {
    AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
    if (am != null) am.cancel(broadcast(c, ACT_DONE, 3));
  }
}
