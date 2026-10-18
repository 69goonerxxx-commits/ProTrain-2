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
  static final String CH_DONE_VIB = "rest_done_vib";
  static final String CH_DONE_SIL = "rest_done_silent";
  static final String CH_WORK = "workout_live";
  static final int ID_LIVE = 4301;
  static final int ID_DONE = 4302;
  static final int ID_WORK = 4303;
  static final long[] BUZZ = new long[] {0, 400, 100, 400, 100, 400};
  static final String ACT_ADD = "com.program.protrain.REST_ADD";
  static final String ACT_SKIP = "com.program.protrain.REST_SKIP";
  static final String ACT_DONE = "com.program.protrain.REST_DONE";
  static final int ORANGE = 0xFFF5A623;

  private RestTimerCore() {}

  static SharedPreferences prefs(Context c) {
    return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }

  // what happens when a rest ends: "sound" (default), "vibrate", "silent" or "off"
  static String mode(Context c) {
    String m = prefs(c).getString("alert", "sound");
    return ("vibrate".equals(m) || "silent".equals(m) || "off".equals(m)) ? m : "sound";
  }

  static boolean workoutOn(Context c) {
    return prefs(c).getBoolean("workout_on", true);
  }

  static void setSettings(Context c, String mode, boolean workout) {
    prefs(c).edit().putString("alert", mode).putBoolean("workout_on", workout).apply();
    if ("off".equals(mode)) {
      prefs(c).edit().putBoolean("active", false).apply();
      cancelLive(c);
      cancelAlarm(c);
      NotificationManager m = nm(c);
      if (m != null) m.cancel(ID_DONE);
    }
    if (!workout) endWorkout(c);
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
    done.setVibrationPattern(BUZZ);
    m.createNotificationChannel(done);
    NotificationChannel doneVib = new NotificationChannel(CH_DONE_VIB, "Rest complete (vibrate only)", NotificationManager.IMPORTANCE_HIGH);
    doneVib.setDescription("Buzzes when your rest ends, no sound");
    doneVib.setSound(null, null);
    doneVib.enableVibration(true);
    doneVib.setVibrationPattern(BUZZ);
    m.createNotificationChannel(doneVib);
    NotificationChannel doneSil = new NotificationChannel(CH_DONE_SIL, "Rest complete (silent)", NotificationManager.IMPORTANCE_LOW);
    doneSil.setDescription("Shows a message when your rest ends, no sound or buzz");
    doneSil.setSound(null, null);
    doneSil.enableVibration(false);
    m.createNotificationChannel(doneSil);
    NotificationChannel work = new NotificationChannel(CH_WORK, "Workout in progress", NotificationManager.IMPORTANCE_LOW);
    work.setDescription("Shows your session time and sets done while you train");
    work.setShowBadge(false);
    work.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    m.createNotificationChannel(work);
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

  static void start(Context c, long end, long total, String title, String prefix, String nextLabel, String nextTarget, String doneTitle, String doneText) {
    prefs(c).edit()
        .putBoolean("active", true).putBoolean("skipped", false).putBoolean("finished", false).putBoolean("svc", false)
        .putLong("end", end).putLong("total", total)
        .putString("title", title).putString("prefix", prefix).putString("nextLabel", nextLabel).putString("next", nextTarget)
        .putString("doneTitle", doneTitle).putString("doneText", doneText)
        .apply();
    NotificationManager m = nm(c);
    if (m != null) m.cancel(ID_DONE);
    if ("off".equals(mode(c))) return;
    showLive(c);
    startSvc(c);
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

  // the countdown notification is kept fresh by a short-lived foreground service (see RestTimerService)
  static void startSvc(Context c) {
    try {
      Intent i = new Intent(c, RestTimerService.class);
      if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i);
      else c.startService(i);
    } catch (Throwable t) {
      // not allowed right now (for example the app is in the background): the plain notification still shows
    }
  }

  static void stopSvc(Context c) {
    try {
      c.stopService(new Intent(c, RestTimerService.class));
    } catch (Throwable t) {
      // ignore
    }
  }

  static void cancelLive(Context c) {
    stopSvc(c);
    NotificationManager m = nm(c);
    if (m != null) m.cancel(ID_LIVE);
  }

  // builds the countdown notification, or null when there is nothing to show
  static Notification buildLive(Context c) {
    SharedPreferences p = prefs(c);
    long end = p.getLong("end", 0);
    long left = end - System.currentTimeMillis();
    if (!p.getBoolean("active", false) || left <= 0 || "off".equals(mode(c))) return null;
    ensureChannels(c);
    String prefix = p.getString("prefix", "");
    String next = p.getString("next", "");
    String nextAt = p.getString("nextLabel", "Next set at") + " " + clock(c, end);
    StringBuilder big = new StringBuilder();
    if (!prefix.isEmpty()) big.append(prefix).append('\n');
    if (!next.isEmpty()) big.append(next).append('\n');
    big.append(nextAt);
    String text = !next.isEmpty() ? next + " \u00b7 " + clock(c, end) : (prefix.isEmpty() ? "" : prefix + ". ") + nextAt;
    NotificationCompat.Builder b = new NotificationCompat.Builder(c, CH_LIVE)
        .setSmallIcon(smallIcon(c))
        .setColor(ORANGE)
        .setContentTitle(p.getString("title", "Rest"))
        .setContentText(text)
        .setStyle(new NotificationCompat.BigTextStyle().bigText(big.toString()))
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
    // the shrinking bar: only while the service is running to redraw it every second (a frozen bar would be misleading)
    if (p.getBoolean("svc", false)) {
      long total = Math.max(Math.max(p.getLong("total", 0), left), 1000);
      int pct = (int) Math.max(0, Math.min(100, left * 100 / total));
      b.setProgress(100, pct, false);
    }
    Bitmap logo = logo(c);
    if (logo != null) b.setLargeIcon(logo);
    PendingIntent open = openApp(c);
    if (open != null) b.setContentIntent(open);
    return b.build();
  }

  static void showLive(Context c) {
    Notification n = buildLive(c);
    if (n == null) {
      NotificationManager m0 = nm(c);
      if (m0 != null) m0.cancel(ID_LIVE);
      return;
    }
    NotificationManager m = nm(c);
    if (m != null) m.notify(ID_LIVE, n);
  }

  // a stand-in used only so a foreground service can always satisfy Android's "show a notification now" rule
  static Notification placeholder(Context c) {
    ensureChannels(c);
    return new NotificationCompat.Builder(c, CH_LIVE)
        .setSmallIcon(smallIcon(c))
        .setColor(ORANGE)
        .setContentTitle("Rest")
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .build();
  }

  // ── workout in progress: session time and sets done ──
  static void showWorkout(Context c, long start, int done, int total, String title) {
    if (!workoutOn(c)) return;
    NotificationManager m = nm(c);
    if (m == null) return;
    ensureChannels(c);
    String text = total > 0 ? done + " of " + total + " sets done" : "Workout in progress";
    NotificationCompat.Builder b = new NotificationCompat.Builder(c, CH_WORK)
        .setSmallIcon(smallIcon(c))
        .setColor(ORANGE)
        .setContentTitle(title)
        .setContentText(text)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setCategory(NotificationCompat.CATEGORY_STATUS)
        .setWhen(start)
        .setShowWhen(true)
        .setUsesChronometer(true)
        .setTimeoutAfter(6L * 60L * 60L * 1000L);
    if (total > 0) b.setProgress(total, Math.min(done, total), false);
    PendingIntent open = openApp(c);
    if (open != null) b.setContentIntent(open);
    m.notify(ID_WORK, b.build());
  }

  static void endWorkout(Context c) {
    NotificationManager m = nm(c);
    if (m != null) m.cancel(ID_WORK);
  }

  static void showDone(Context c) {
    String mode = mode(c);
    if ("off".equals(mode)) return;
    SharedPreferences p = prefs(c);
    NotificationManager m = nm(c);
    if (m == null) return;
    ensureChannels(c);
    String ch = "vibrate".equals(mode) ? CH_DONE_VIB : "silent".equals(mode) ? CH_DONE_SIL : CH_DONE;
    NotificationCompat.Builder b = new NotificationCompat.Builder(c, ch)
        .setSmallIcon(smallIcon(c))
        .setColor(ORANGE)
        .setContentTitle(p.getString("doneTitle", "Rest complete"))
        .setContentText(p.getString("doneText", "Time for your next set."))
        .setAutoCancel(true)
        .setPriority("silent".equals(mode) ? NotificationCompat.PRIORITY_LOW : NotificationCompat.PRIORITY_HIGH)
        .setCategory(NotificationCompat.CATEGORY_REMINDER)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setTimeoutAfter(180000);
    // Android 8+ takes sound and vibration from the channel; these lines cover older phones
    if ("sound".equals(mode)) b.setVibrate(BUZZ).setDefaults(NotificationCompat.DEFAULT_SOUND);
    else if ("vibrate".equals(mode)) b.setVibrate(BUZZ);
    else b.setSilent(true);
    Bitmap logo = logo(c);
    if (logo != null) b.setLargeIcon(logo);
    PendingIntent open = openApp(c);
    if (open != null) b.setContentIntent(open);
    m.notify(ID_DONE, b.build());
  }

  static void scheduleDone(Context c, long end) {
    if ("off".equals(mode(c))) return;
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
