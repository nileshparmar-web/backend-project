import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiErrors.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import path from "path";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";

// method for generating the accessToken and refreshToken
const generateAccessTokenAndRefreshToken = async (userId) => {

    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
    
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false});

        return { accessToken, refreshToken }

    } catch (error) {
         throw new ApiError(500, "Something went wrong while generating refreshToken and accessToken ")
    }
}

const registerUser = asyncHandler( async (req, res) => {
    
    // steps to follow for registere the user
    // get user details from frontend
    // validation of user details - non empty
    // chek is user already exists
    // check for cover images and check for avatar
    // upload them to cloudinary
    // create user object - create entry in db
    // remove password and refreshtoken from response
    // check for user creation
    // return res

    console.log("Files received by Multer:", req.files);

    // here we are fetching the detail of user
    const { username, fullName, email, password } = req.body;
    console.log("email : " , email);
    console.log("username : " , username);

    console.log("here the body: " , req.body);

    // we are validates fieldes are empty or not

    if ([fullName, email, password, username].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required..")
    }

    // here i am going to check the format of imail is correct or not

    if(!email.includes("@") && 
        email.indexof("@") === 0 &&
        email.indexof("@") === email.length - 1 &&
        email.split("@")[0].length === 0 &&
        email.split("@")[1].length === 0 &&
        !email.split("@")[1].includes(".") &&
        email.split("@")[1].indexof(".") === 0 &&
        email.split("@")[1].indexof(".") === email.split("@")[1].length - 1 ){

            throw new ApiError(400, "Invalid email format, provide correct email");
            
        }

    //here we are checks the user is already exist or not
    const existedUser = await User.findOne({
        $or : [{ username }, { email }]
    })

    if(existedUser) {
        throw new ApiError(409, "User with email or username already exist");
        
    }

    // take avatar file and coverImage file from user and put temporary in local server

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
         coverImageLocalPath = req.files.coverImage[0].path;
    }

    console.log("Avatar Path:", avatarLocalPath); 
    console.log("CoverImage's Path :", coverImageLocalPath);

    if(!avatarLocalPath) {
      throw new ApiError(400, "Avatar file is required in local server ")
    }

    // upload them to cloudinary
    const avatar = await uploadOnCloudinary(path.resolve(avatarLocalPath));
    console.log("Cloudinary Upload Result for avatar:", avatar);

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    console.log("Cloudinary Upload Result for coverImage:", coverImage); 

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required..")
    }

    // now upload all this data and files path in database

    const user = await User.create(
        { fullName,
          avatar : avatar.url,
          coverImage : coverImage?.url || "",
          email,
          password,
          username: username.toLowerCase()
        })

    // here we checked the user's data successfully entered in db and also select which item we dont want to add in response
    const createdUser = await User.findById(user._id).select(" -password -refreshToken ")
     
    if(!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    // here we send the respond that user is successfully registered
    return res.status(201).json(
        new ApiResponse(200, createdUser, "user registered successfully..")
    )



})

const loginUser = asyncHandler( async (req, res) => {
    // take data from user using req.body
    // check the username or email is exist for that user
    // find the user
    // check the password
    // generate accesstoken and refreshtoken 
    // send cookies to user
    

    // fetch data from user
    const { username, email, password } = req.body;
    console.log("equested body: ", req.body);
    

    // check the user provide username or email
    if( !(username || email)) {
        throw new ApiError(400, "username or email is required for login")
    }

    // find user
    const user = await User.findOne({
        $or: [{ username }, { email }]
    })
    console.log("logined user: ", user)

    if(!user) {
        throw new ApiError(404, "User does not exist..")
    }

    // validate the password
    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid) {
        throw new ApiError(401, "Paasword is Invalid");
    }

    // generate the tokens
    const { accessToken, refreshToken } =   await generateAccessTokenAndRefreshToken(user._id);
    console.log("accessToken : ",accessToken);
    console.log("refreshToken : ", refreshToken);
    

    const loggedInUser = await User.findById(user._id).select(" -password  -refreshToken");
    console.log("logedInUser : ", loggedInUser);
    

    // send cookies
    const options = {
          httpOnly: true,
          secure: true
    }

    console.log("Sending Response:", {
           user: loggedInUser,
                  accessToken,
                  refreshToken
});
const resp= new ApiResponse(
     new ApiResponse(
      200,
      {
        user: loggedInUser,
        accessToken,
        refreshToken
      },
      "User logedIn Successfully.."
    )
)

return res
  .status(200)
  .cookie("accessToken", accessToken, options)
  .cookie("refreshToken", refreshToken, options)
  .json(
    new ApiResponse(
      200,
      {
        user: loggedInUser,
        accessToken,
        refreshToken
      },
      "User logedIn Successfully.."
    )
  );
})

const logoutUser = asyncHandler( async (req, res) => {

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken : undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
          httpOnly: true,
          secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200, {}, "User loggedOut Successfully")
    )


      
})

const refreshAccessToken = asyncHandler(async (req, res) => {
      
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request..")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used..")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessTokenAndRefreshToken(user._id);
    
        return res
        .status(200)
        .cookie("accessToke", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    accessToken,
                    refreshToken: newRefreshToken
                },
                "Access token Refreshed successfully.."
               
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Refresh Token..")
    }
})

const changecurrentPassword = asyncHandler( async (req, res) => {

    // take required data from user
    const {currentPassword, newPassword, confirmPassword} = req.body;
    console.log("req.body: ", req.body);

    // verify that current password and newpassword are same if they same return error
    if (currentPassword === newPassword) {
          throw new ApiError(400, "New password cannot be the same as the current password")    
    }

    //verify that newpassword and confirm password are same
    if(!(newPassword === confirmPassword)){
        throw new ApiError(400, "New password and confirm password do not match")
    }

    //find the user 
    const user = await User.findById(req.user?._id);
    console.log("user who want to update password: ", user);

   // verify user's current password for validation
   const isCurrentPsswordCorrect = user.isPasswordCorrect(currentPassword);

   if(!isCurrentPsswordCorrect) {
       throw new ApiError(400, "Invalid Current Password..");
   }

   // set new password in user's object
   user.password = newPassword;
   // save the user 
   await user.save({ validateBeforeSave: false });
   console.log("user after update password: ", user);

   // send the response that password changed successfuly
   return res
   .status(200)
   .json(new ApiResponse(200, {} , "Password Changed Successfully.."))


})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json( new ApiResponse(200, { user: req.user }, "Current User fetch Successfully.."))
})

const updateAccountDetails = asyncHandler(async (req, res) => {

    // take details from user that user has permissions to update
    const { fullName, email } = req.body;
    console.log("new details: ", req.body);

    // verify that details are correct or not
    if (!( fullName || email)) {
        throw new ApiError(400, "All fields are required..")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName: fullName,
                   email: email
            }
        },
        {
            new: true
        }
    ).select("-password")
    console.log("user after update the details: ",user);

    // send the request
    return res
    .status(200)
    .json(new ApiResponse(200, { user }, "Account Details Updated Successfully.." ))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
      
    // take file from user
    const avatarLocalPath = req.file?.path;
    console.log("new avatar file localPath: ", avatarLocalPath)

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing..")
    }
   
    // upload new avatar file on cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    console.log("uploaded avatar on cloudinary: ", avatar)

    if(!avatar.url){
       throw new ApiError(400, "Error while uploading on cloudinary..")
    }

    // find the user and set new avatar url from cloudinary
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar : avatar.url
            }
        },
        {
            new: true
        }
    ).select("-password")
    console.log("user after update avatar file: ", user);

    // send the respose 
    return res
    .status(200)
    .json( new ApiResponse(200, { user }, "Avatar file Updated Successfully.."))

})

const updateUserCoverImage = asyncHandler(async (req, res) => {
      
    // take file from user
    const coverImageLocalPath = req.file?.path;
    console.log("new coverImage file localPath: ", coverImageLocalPath)

    if(!coverImageLocalPath){
        throw new ApiError(400, "coverImage file is missing..")
    }
   
    // upload new coverImage file on cloudinary
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    console.log("uploaded coverImage on cloudinary: ", coverImage)

    if(!coverImage.url){
       throw new ApiError(400, "Error while uploading on cloudinary..")
    }

    // find the user and set new coverImage url from cloudinary
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar : coverImage.url
            }
        },
        {
            new: true
        }
    ).select("-password")
    console.log("user after update coverImage file: ", user);

    // send the respose 
    return res
    .status(200)
    .json( new ApiResponse(200, { user }, "coverImage file Updated Successfully.."))

})

const getUserChannelProfile = asyncHandler(async (req, res) => {

    const { username } = req.params;

    if(!username?.trim()){
        throw new ApiError(400, "username is missing..")
    }

    // let alex has one youtube channel
    const channel = await User.aggregate([
        {
            $match: {
                username : username?.toLowerCase()
            }
        },
        {
            // here which users are subscribed alex's channel..
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            // here which channel's are subscribed by alex..
            $lookup: {
                from:"subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount: {
                    $size : "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size : "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    console.log("channel's information: ", channel);

    if(!channel?.length){
        throw new ApiError(404, "channel does not exist..")
    }

    return res
    .status(200)
    .json( new ApiResponse(200, channel[0], "User channel fetched successfully.."))
})

const getWatchHistory = asyncHandler(async (req, req) => {
    const user = User.aggregate([
         {
            $match: {
                _id: mongoose.Types.ObjectId(req.user._id)

            }
         },
         {
            $lookup: {
                from:"videos",
                localField: "watchHistory",
                foreignField:"_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline: [
                                {
                                    $project: {
                                        username: 1,
                                        fullName: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
         }
    ])

    return res
    .status(200)
    .json( new ApiResponse(200, user[0].watchHistory, "watch History fetched successfully.."))
})





export { registerUser,
         loginUser,
         logoutUser,
         refreshAccessToken,
         changecurrentPassword,
         getCurrentUser,
         updateAccountDetails,
         updateUserAvatar,
         updateUserCoverImage,
         getUserChannelProfile,
         getWatchHistory
 }


