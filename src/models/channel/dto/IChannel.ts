import { IPermissionOverwrites } from "./IPermissionOverwrites";

export interface IChannel {
	guild: string;
	name: string;
	id: string;
	type: number;
	rateLimitPerUser: number;
	bitrate: number;
	parent: string;
	topic: string;
	position: number;
	userLimit: number;
	nsfw: boolean;
	permissionOverwrites: IPermissionOverwrites[];
}
