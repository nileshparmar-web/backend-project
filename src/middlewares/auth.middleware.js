import {asyncHandler} from "../utils/asyncHandler.js"
import { ApiError} from "../utils/ApiErrors.js"
import jwt from "jsonwebtoken"
import { User } from "../models/user.model.js"

const verifyJWT =  asyncHandler(async (req, res, next) => {

      try {
         const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")
  
         if (!token) {
             throw new ApiError(401, "Unautherized Request..")
         }
  
         const decodedInfo = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET )
  
         const user = await User.findById(decodedInfo?._id).select("-password -refreshToken")
  
         if (!user) {
            throw new ApiError(401, "Invalid Access Token")
         }
  
         req.user = user;
         next()

      } catch (error) {
          throw new ApiError(401, error?.message || "Invalid Access Token..")
      }

})

export { verifyJWT }