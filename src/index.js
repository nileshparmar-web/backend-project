import dotenv from "dotenv";
import { app } from "./app.js";

import connectDB from "./db/index.js";

dotenv.config({
    path: './.env'
});



connectDB()
.then( () => {
      app.listen(process.env.PORT || 8000, () => {
        console.log(`app is listening on port ${process.env.PORT}`)
      })
})
.catch( (err) => {
     console.log("ERORO : DADABASE CONNECTION FAILED ", err)
})
