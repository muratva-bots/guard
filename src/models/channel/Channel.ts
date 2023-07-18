import { Schema, model } from "mongoose";
import { IChannel } from "./dto";

const channelSchema = new Schema({
	guild: String,
	name: String,
	id: String,
	type: Number,
	parent: { type: String, default: undefined },
	topic: { type: String, default: undefined },
	position: { type: Number, default: undefined },
	userLimit: { type: Number, default: undefined },
	nsfw: { type: Boolean, default: undefined },
	permissionOverwrites: { type: Array, default: [] },
	rateLimitPerUser: { type: Number, default: undefined },
	bitrate: { type: Number, default: undefined },
});

export const ChannelModel = model<IChannel>("Channel", channelSchema);