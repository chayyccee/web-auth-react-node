const crypto = require('crypto');

const { reset } = require('nodemon');
const User = require('../models/Users');
const ErrorResponse = require('../utils/errorResponse');
const sendEmail = require('../utils/sendEmail');

exports.register = async (req, res, next) => {
    //pass in username that will be received
    const { username, email, password } = req.body;

    try {
        const user = await User.create({
            username, email, password
        });
        //  in here is usually a response with a token from jwt
        sendToken(user, 201, res);

        // the response below is for testing on postman
        // res.status(201).json({
            //  success: true,
            // user
         //   token: "ererr345rr5rf5"
     //   });
    } catch (error) {
        // use this code below 
        // res.status(500).json({
         //   success: false,
         //   error: error.message,
        //});
        // or better still use custom made error handler
        next(error);
    }
};

exports.login = async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        // res.status(400).json({ success: false, error: "please provide an email and a password"})

        // use custome error handler
        return next(new ErrorResponse("please provide an email address and a password", 400));
    }

    try {
        const user = await User.findOne({ email }).select("+password");

        if (!user) {
           // res.status(404).json({ success: false, error: "User not found" })

            // use custome error handler
            return next(new ErrorResponse("User not found", 401));
        }

        const isMatch = await user.matchPasswords(password);

        if (!isMatch) {
            // res.status(404).json({ success: false, error: "Invalid Credentials"})

            // use custome error handler
            return next(new ErrorResponse("Invalid Credentials", 401));
        }
        sendToken(user, 200, res);
        // the line below is a test for the api
        // res.status(200).json({ success: true, token: "tghyhg3567ki34g"});
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

exports.forgotpassword = async (req, res, next) => {
    // res.send("Forgot Password Route");

    const { email } = req.body;

    try {
        const user = await User.findOne({ email });

        if(!user) {
            return next(new ErrorResponse("Email could not be sent", 404))
        }

        const resetToken = user.getResetPasswordToken();

        await user.save();

        const resetUrl = `http://localhost:3000/passwordreset/${resetToken}`;

        const message = `
            <h1>You have requested a password reset</h1>
            <p>Please go to this link to reset your password</p>
            <a href=${resetUrl} clicktracking=off>${resetUrl}</a>
        `
        try {
           await sendEmail({
               to: user.email,
               subject: "Password Reset Request",
               text: message
           });

           res.status(200).json({ success: true, data: "Email Sent" })
        } catch (error) {
            user.resetpasswordToken = undefined;
            user.resetPasswordExpire = undefined;

            await user.save();

            return next(new ErrorResponse("Email could not be sent", 500));
        }
    } catch (error) {
        next(error);
    }
};

exports.resetpassword = async (req, res, next) => {
    // res.send("Reset Password Route");

    const resetPasswordToken = crypto.createHash("sha256").update(req.params.resetToken).digest
    ("hex");

    try {
        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        })

        if (!user) {
            return next(new ErrorResponse("Invalid Reset Token", 400));
        }

        user.password = req.body.password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save();

        res.status(201).json({
            success: true,
            data: "Password Reset Success"
        })
    } catch (error) {
        next(error);
    }
};

const sendToken = (user, statusCode, res) => {
    const token = user.getSignedToken();
    res.status(statusCode).json({ success: true, token});
};