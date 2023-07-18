import { OverwriteType } from "discord.js";
import { PermissionsString } from "discord.js";

export type IPermissions = {
	[key in PermissionsString]: boolean | null;
};

export interface IPermissionOverwrites {
	id: string;
	type: OverwriteType;
	permissions: IPermissions;
}
