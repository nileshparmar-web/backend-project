/*

this approach is good but here modularity of project is not maintain

import dotenv from "dotenv";
import mongoose from "mongoose";
import {DB_NAME} from "./constants.js";
import express from "express" ;

dotenv.config();

const app = express();
(async () => {
       try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        console.log("DATABASE IS CONNECTED");
        app.listen(process.env.PORT, () => {
            console.log(`APP is listening on port ${process.env.PORT}`);
        })
         
        
       } catch (error) {
            console.error("ERROR : ", error);
            throw error;
            
       }
})()  */