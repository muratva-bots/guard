import { IChannelOverwrite } from "./IChannelOverwrite";

export interface IRole {
	guild: string;
	name: string;
	id: string;
	color: number;
	position: number;
	permissions: string;
	channelOverwrites: IChannelOverwrite[];
	members: string[];
	hoist: boolean;
	mentionable: boolean;
}