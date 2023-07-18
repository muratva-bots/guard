import { PermissionsString } from "discord.js";

export type IPermissions = {
	[key in PermissionsString]: boolean | null;
};

export interface IChannelOverwrite {
	id: string;
	permissions: IPermissions;
}
