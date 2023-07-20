import { Schema, model, Document } from 'mongoose';

export interface ISettings {
    [key: string]: any;
}

export interface IGuild extends Document {
    id: string;
    settings: ISettings;
}

const guildSchema = new Schema({
    id: String,
    settings: { type: Object, default: { guard: {}, moderation: {} } },
});

export const GuildModel = model<IGuild>('Guild', guildSchema);
