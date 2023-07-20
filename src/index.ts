import { Client } from '@/structures';
import mongoose from 'mongoose';

const client = new Client();
mongoose.set('strictQuery', false);

client.connect();
/*
process.on('unhandledRejection', (error: Error) => console.log(`${error.name}: ${error.message}`));
process.on('uncaughtException', (error: Error) => console.log(`${error.name}: ${error.message}`));
*/


process.on("SIGINT", async () => {
	client.destroy();
    await mongoose.disconnect();
	process.exit();
});
