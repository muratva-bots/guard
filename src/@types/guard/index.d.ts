import { IGuild } from "@guard-bot/models";
import { Client } from "@guard-bot/structures";
import { ClientEvents, Message } from "discord.js";

declare global {
	namespace Guard {
		export type EventKeys = keyof ClientEvents;
		export type ArgsOf<K extends EventKeys> = ClientEvents[K];

		export interface ILimit {
			count: number;
			lastDate: number;
		}

		export interface IEvent {
			name: EventKeys;
			execute: (client: Client, ...args: any[]) => Promise<void> | void;
		}

		export interface ICommand {
			usages: string[];
			execute: (commandArgs: CommandArgs) => Promise<unknown> | unknown;
		}

		export interface CommandArgs {
			client: Client;
			message: Message;
			args: string[];
			guildData: IGuild;
		}

		export type TSafe =
			| "FULL"
			| "GENERAL"
			| "ROLE"
			| "CHANNEL"
			| "EMOJI"
			| "STICKER"
			| "BAN_KICK"
			| "WEBHOOK"
			| "VOICE_KICK";
	}
}
