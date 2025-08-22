
import mongoose from "mongoose";

import {DB_NAME} from "../constants.js";



const connectDB = async () => {
    try {

        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);

        console.log(`DATABASE CONECTED SUCCESSFULLY !! DB HOST : ${connectionInstance.connection.host}`)
        
    } catch (error) {
         console.error("MongoDb is not conected and respond error");
         process.exit(1);
    }
}

export default connectDB