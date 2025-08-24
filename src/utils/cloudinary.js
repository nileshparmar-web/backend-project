import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

import { v2 as cloudinary } from 'cloudinary';


    cloudinary.config({ 
        cloud_name: CLOUDINARY_CLOUD_NAME, 
        api_key: CLOUDINARY_API_KEY, 
        api_secret: CLOUDINARY_API_SECRET 
    });

const uploadOnCloudinary = async (localFilePath) => {

    try {
        if(!localFilePath) return null;

        //upload the file on cloudinary
       const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto" 
        })
        //file hasbeen uploaded successfully
        console.log("file is uploaded on cloudinary", response.url);
        return response;

    } catch (error) {
        //remove the locally saved temporary file as the upload operation got failed
        fs.unlinkSync(localFilePath);
        return null;
    }
}

export { uploadOnCloudinary }
