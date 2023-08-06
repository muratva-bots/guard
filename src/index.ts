import { Client, SelfClient } from '@/structures';
import mongoose from 'mongoose';

mongoose.set('strictQuery', false);

const client = new Client();
client.connect();

const selfClient = new SelfClient();
selfClient.start().then((value) => (client.utils.vanityClient = value));

process.on('unhandledRejection', (error: Error) => console.log(`[ERROR]: ${error.name}: ${error.message}`));
process.on('uncaughtException', (error: Error) => console.log(`[ERROR]: ${error.name}: ${error.message}`));
