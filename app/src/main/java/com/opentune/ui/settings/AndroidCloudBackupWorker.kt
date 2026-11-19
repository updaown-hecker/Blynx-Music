package com.opentune.ui.settings

import android.content.Context
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class AndroidCloudBackupWorker(context: Context, parameters: WorkerParameters) :
    CoroutineWorker(context, parameters) {

    override suspend fun doWork(): Result {
        if (!AndroidCloudBackup.hasConnection(applicationContext)) return Result.success()
        val visible = withContext(Dispatchers.Main.immediate) {
            ProcessLifecycleOwner.get().lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)
        }
        if (visible) return Result.retry()
        return if (AndroidCloudBackup.check(applicationContext, allowUpload = true)) Result.success() else Result.retry()
    }

    companion object {
        private const val RECURRING = "blynx-cloud-backup"
        private const val AFTER_CLOSE = "blynx-cloud-backup-after-close"
        private val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .setRequiresBatteryNotLow(true)
            .build()

        internal fun observeApp(context: Context) {
            val app = context.applicationContext
            if (AndroidCloudBackup.hasConnection(app)) schedule(app)
            ProcessLifecycleOwner.get().lifecycle.addObserver(object : DefaultLifecycleObserver {
                override fun onStop(owner: LifecycleOwner) {
                    if (!AndroidCloudBackup.hasConnection(app)) return
                    val request = OneTimeWorkRequestBuilder<AndroidCloudBackupWorker>()
                        .setConstraints(constraints)
                        .setInitialDelay(2, TimeUnit.MINUTES)
                        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES)
                        .build()
                    WorkManager.getInstance(app).enqueueUniqueWork(AFTER_CLOSE, ExistingWorkPolicy.KEEP, request)
                }
            })
        }

        internal fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<AndroidCloudBackupWorker>(6, TimeUnit.HOURS)
                .setConstraints(constraints)
                .setInitialDelay(15, TimeUnit.MINUTES)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(RECURRING, ExistingPeriodicWorkPolicy.KEEP, request)
        }

        internal fun cancel(context: Context) {
            val manager = WorkManager.getInstance(context)
            manager.cancelUniqueWork(AFTER_CLOSE)
            manager.cancelUniqueWork(RECURRING)
        }
    }
}
