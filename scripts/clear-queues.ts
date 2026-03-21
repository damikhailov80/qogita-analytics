import 'dotenv/config';
import Redis from 'ioredis';

const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
});

async function clearQueues() {
    console.log('🧹 Clearing all BullMQ queues...');

    try {
        // Получаем все ключи, связанные с BullMQ
        const keys = await redis.keys('bull:*');

        if (keys.length === 0) {
            console.log('✅ No queue data found');
            await redis.quit();
            return;
        }

        console.log(`Found ${keys.length} keys to delete`);

        // Удаляем все ключи батчами
        const batchSize = 100;
        for (let i = 0; i < keys.length; i += batchSize) {
            const batch = keys.slice(i, i + batchSize);
            await redis.del(...batch);
            console.log(`Deleted ${Math.min(i + batchSize, keys.length)}/${keys.length} keys`);
        }

        console.log('✅ All queues cleared successfully');
    } catch (error) {
        console.error('❌ Error clearing queues:', error);
        process.exit(1);
    } finally {
        await redis.quit();
    }
}

clearQueues();
