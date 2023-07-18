import { Schema, model } from "mongoose";
import { IGuild } from "./dto";

const guildSchema = new Schema({
	id: String,
	settings: { type: Object, default: { guard: {}, moderation: {} } },
});

export const GuildModel = model<IGuild>("Guild", guildSchema);
