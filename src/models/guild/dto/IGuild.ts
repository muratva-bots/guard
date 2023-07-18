import { Document } from "mongoose";
import { ISettings } from "./ISettings";

export interface IGuild extends Document {
	id: string;
	settings: ISettings;
}
