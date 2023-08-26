import { Client, SelfClient } from '@/structures';
import mongoose from 'mongoose';

mongoose.set('strictQuery', false);

const client = new Client();
client.connect();

const selfClient = new SelfClient();
selfClient.start().then((value) => (client.utils.vanityClient = value));


process.on("uncaughtException", (err) => {
	const errorMsg = err.stack.replace(new RegExp(`${__dirname}/`, "g"), "./");
	console.error("[ERROR]:", errorMsg);
});

process.on('unhandledRejection', (error: Error) => console.log(`[ERROR]: ${error.name}: ${error.message}`));
