require("dotenv").config();
const express = require("express");
const cors = require("cors");

const multer = require("multer");
const mysql = require("mysql2");
const https = require("https");
const xlsx = require("xlsx");
const bodyParser = require("body-parser");
const path = require("path");

const fs = require("fs");

const app = express();
const port = process.env.PORT;

app.use(express.json());
app.use(cors());

// Define storage for file uploads with a 10MB limit (you can adjust this limit)
const fileStorage = multer.memoryStorage();
const fileUpload = multer({
  storage: fileStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 10MB limit (you can adjust this limit)
});

const excelStorage = multer.memoryStorage();
const excelUpload = multer({
  storage: excelStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /xlsx|xls/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (extname) {
      return cb(null, true);
    }

    cb("Error: Only Excel files are allowed!");
  },
});

// Create a MySQL database connection
const db = mysql.createConnection({
  host: "15.207.42.176",
  user: "pypdbuser",
  password: "Tgc@12345",
  database: "pypdb",
  //database: "pypdb_beta",
});

/* const httpsOptions = {
    key: fs.readFileSync('C:\\Certificates\\private-key.key'), 
    cert: fs.readFileSync('C:\\Certificates\\ca-bundle.crt'),
    
}; */

const httpsOptions = {
  key: fs.readFileSync("/opt/bitnami/letsencrypt/certificates/m2ost.com.key"),
  cert: fs.readFileSync("/opt/bitnami/letsencrypt/certificates/m2ost.com.crt"),
  // passphrase: "Tgc@0987",
};

// const httpsOptions = {
//   key: fs.readFileSync('D:\\Skillmuni.in SSL Certificate file\\skillmuni_key.pem'),
//   cert: fs.readFileSync('D:\\Skillmuni.in SSL Certificate file\\skillmuni_certificate.crt'),
//   passphrase: 'Tgc@0987'

// };

// const server = https.createServer(httpsOptions, app).listen(8080, () => {
//   console.log("Server running on https://localhost:8080/");
// });

// const httpsOptions = {
//   key: fs.readFileSync("/opt/bitnami/apache/conf/connectopia.app.key"),
//   cert: fs.readFileSync("/opt/bitnami/apache/conf/connectopia.app.crt"),
// };

// Define the directory where uploaded files are stored
app.use("/uploads", express.static("uploads"));

// Define a route to post user details to tbl_user with auto-generated updated_datetime
app.post("/postUserDetails", (req, res) => {
  const { org_id, user_id, source } = req.body;

  if (!org_id || !user_id || !source) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Check if the user already exists in tbl_user
  db.query(
    "SELECT * FROM tbl_user WHERE org_id = ? AND user_id = ?",
    [org_id, user_id],
    (error, results) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ error: "Error checking user existence" });
      }

      if (results.length > 0) {
        // User already exists in tbl_user, return an error
        return res.status(400).json({ error: "User already exists" });
      }

      // User does not exist, create a new user
      db.query(
        "INSERT INTO tbl_user (org_id, user_id, source, updated_datetime) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
        [org_id, user_id, source],
        (error, results) => {
          if (error) {
            console.error(error);
            res.status(500).json({ error: "Error posting user details" });
          } else {
            res.json({
              message: "User details posted successfully",
              userId: results.insertId,
            });
          }
        }
      );
    }
  );
});

// Create a route for inserting values into tbl_uploadfile_master
app.post("/insertUploadFileMaster", (req, res) => {
  const { file_type, file_size, file_duration, org_id } = req.body;

  if (!file_type || !file_size || !file_duration || !org_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  db.query(
    "INSERT INTO tbl_uploadfile_master (file_type, file_size, file_duration, org_id) VALUES (?, ?, ?, ?)",
    [file_type, file_size, file_duration, org_id],
    (error, results) => {
      if (error) {
        console.error(error);
        res
          .status(500)
          .json({ error: "Error inserting into tbl_uploadfile_master" });
      } else {
        res.json({
          message: "Values inserted successfully",
          fileId: results.insertId,
        });
      }
    }
  );
});

// Create a route for uploading files with different types
app.post("/insertFileContext", (req, res) => {
  const { org_id, context, subtype, call_to_action } = req.body;

  if (!org_id || !context || !subtype || !call_to_action) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  db.query(
    "INSERT INTO tbl_filecontext_master (org_id, context, subtype, call_to_action) VALUES (?, ?, ?, ?)",
    [org_id, context, subtype, call_to_action],
    (error, results) => {
      if (error) {
        console.error(error);
        res.status(500).json({ error: "Error inserting values" });
      } else {
        res.json({
          message: "Values inserted successfully",
          fileId: results.insertId,
        });
      }
    }
  );
});

// Create a route to get contexts without subtypes based on org_id
// app.get("/getAllContexts", (req, res) => {
//   const org_id = req.query.org_id;

//   db.query(
//     "SELECT id_filecontext, context, subtype, call_to_action FROM tbl_filecontext_master WHERE org_id = ?",
//     [org_id],
//     (error, results) => {
//       if (error) {
//         console.error(error);
//         res.status(500).json({
//           error: "Error retrieving contexts for the specified org_id",
//         });
//       } else {
//         res.json(results);
//       }
//     }
//   );
// });

// Modified GET route to retrieve contexts with subtypes
app.get("/getAllContexts", (req, res) => {
  const org_id = req.query.org_id;

  db.query(
    "SELECT DISTINCT context FROM tbl_filecontext_master WHERE org_id = ?",
    [org_id],
    (error, contextResults) => {
      if (error) {
        console.error(error);
        res.status(500).json({
          error: "Error retrieving contexts for the specified org_id",
        });
      } else {
        // For each context, retrieve subtypes
        const contextsWithSubtypes = contextResults.map(
          async (contextResult) => {
            const context = contextResult.context;

            // Retrieve subtypes for the current context
            const subtypes = await new Promise((resolve) => {
              db.query(
                "SELECT DISTINCT subtype FROM tbl_filecontext_master WHERE context = ? AND org_id = ?",
                [context, org_id],
                (error, subtypeResults) => {
                  if (error) {
                    console.error(error);
                    resolve([]);
                  } else {
                    resolve(
                      subtypeResults.map(
                        (subtypeResult) => subtypeResult.subtype
                      )
                    );
                  }
                }
              );
            });

            return { context, subtypes };
          }
        );

        // Wait for all context-subtype pairs to be retrieved
        Promise.all(contextsWithSubtypes).then((contexts) => {
          res.json(contexts);
        });
      }
    }
  );
});

// Create a route to get subtypes based on context
app.get("/getSubtypesByContext", (req, res) => {
  const context = req.query.context;
  const org_id = req.query.org_id;

  db.query(
    "SELECT DISTINCT subtype FROM tbl_filecontext_master WHERE context = ? AND org_id = ?",
    [context, org_id],
    (error, results) => {
      if (error) {
        console.error(error);
        res.status(500).json({
          error: "Error retrieving subtypes for the specified context",
        });
      } else {
        res.json(results);
      }
    }
  );
});

// Create a route for uploading files with different types using query parameters
// app.post("/useruploadapi", fileUpload.single("file"), (req, res) => {
//   const id_user = req.query.id_user;
//   const org_id = req.query.org_id;
//   const user_id = req.query.user_id;
//   const receivers_id_user = req.query.receivers_id_user;
//   const receiver_org_id = req.query.receiver_org_id;
//   const receiver_user_id = req.query.receiver_user_id;
//   const user_message = req.query.user_message;
//   const file_context = req.query.file_context;
//   const sub_type = req.query.sub_type;
//   const user_firstname = req.query.user_firstname;
//   const user_lastname = req.query.user_lastname;
//   const rtm_id_user = req.query.rtm_id_user;
//   const rtm_user_id = req.query.rtm_user_id;
//   const rtm_org_id = req.query.rtm_org_id;

//   if (
//     !id_user ||
//     !org_id ||
//     !user_id ||
//     !receivers_id_user ||
//     !receiver_org_id ||
//     !receiver_user_id ||
//     !file_context ||
//     !sub_type ||
//     !user_firstname ||
//     !user_lastname ||
//     !rtm_id_user ||
//     !rtm_user_id ||
//     !rtm_org_id
//   ) {
//     return res.status(400).json({ error: "Missing required parameters" });
//   }

//   const file = req.file;

//   if (!file) {
//     return res.status(400).json({ error: "No file provided" });
//   }

//   const { originalname, mimetype, buffer } = file;

//   // Define a variable to store the file type based on the MIME type
//   let fileType;

//   if (mimetype.startsWith("video/")) {
//     fileType = "video";
//   } else if (mimetype.startsWith("audio/")) {
//     fileType = "audio";
//   } else if (
//     mimetype === "application/msword" ||
//     mimetype ===
//       "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
//   ) {
//     fileType = "docx";
//   } else if (mimetype === "application/pdf") {
//     fileType = "pdf";
//   } else if (
//     mimetype.startsWith("application/vnd.ms-powerpoint") ||
//     mimetype ===
//       "application/vnd.openxmlformats-officedocument.presentationml.presentation"
//   ) {
//     fileType = "ppt"; // Correct MIME types for PPT and PPTX files
//   } else if (mimetype.startsWith("image/")) {
//     fileType = "image"; // Detect images based on MIME type
//   } else {
//     fileType = "unknown"; // You can handle other file types as needed
//   }

//   // Check if the uploaded file size, org_id, and file_type are within acceptable limits
//   db.query(
//     "SELECT file_size FROM tbl_uploadfile_master WHERE org_id = ? AND file_type = ?",
//     [org_id, fileType],
//     (error, uploadFileResults) => {
//       if (error) {
//         console.error(error);
//         return res.status(500).json({
//           error: "Error checking file size and org_id",
//         });
//       }

//       if (uploadFileResults.length === 0) {
//         return res.status(400).json({
//           error: "File type or org_id is not supported",
//         });
//       }

//       const uploadFileSizeLimit = uploadFileResults[0].file_size;

//       // Create a user-specific subdirectory if it doesn't exist
//       const userUploadDirectory = `uploads/${id_user}/${fileType}`;
//       if (!fs.existsSync(userUploadDirectory)) {
//         fs.mkdirSync(userUploadDirectory, { recursive: true });
//       }

//       // Generate a unique file name to avoid conflicts
//       const uniqueFileName = `${Date.now()}-${originalname}`;

//       // Save the file within the user's subdirectory
//       const filePath = `${userUploadDirectory}/${uniqueFileName}`;
//       fs.writeFileSync(filePath, buffer);

//       // Insert the file information into tbl_userupload_details
//       db.query(
//         "INSERT INTO tbl_userupload_details (id_user, org_id, user_id, receivers_id_user, receiver_org_id, receiver_user_id, rtm_id_user, rtm_org_id, rtm_user_id, file_type, file_name, file_path, status, user_message, file_context, sub_type,user_firstname, user_lastname,upload_datetime) VALUES (?, ?, ?, ?, ?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?,?)",
//         [
//           id_user,
//           org_id,
//           user_id,
//           receivers_id_user,
//           receiver_org_id,
//           receiver_user_id,
//           rtm_id_user,
//           rtm_org_id,
//           rtm_user_id,
//           fileType,
//           originalname,
//           filePath,
//           "uploaded",
//           user_message,
//           file_context,
//           sub_type,
//           user_firstname,
//           user_lastname,
//           new Date(), // You can adjust this if needed
//         ],
//         (error, results) => {
//           if (error) {
//             console.error(error);
//             res.status(500).json({ error: "Error uploading the file" });
//           } else {
//             // After successfully inserting into tbl_userupload_details, insert into tbl_uploadfile_master
//             res.json({
//               message: "File uploaded successfully",
//               fileId: results.insertId,
//             });
//           }
//         }
//       );
//     }
//   );
// });

// General File Upload API
app.post("/useruploadapi", fileUpload.single("file"), (req, res) => {
  // Extract necessary parameters from the request
  const {
    id_user,
    org_id,
    user_id,
    receivers_id_user,
    receiver_org_id,
    receiver_user_id,
    user_message,
    file_context,
    sub_type,
    user_firstname,
    user_lastname,
  } = req.query;

  // Extract file-related parameters
  const { originalname, mimetype, buffer } = req.file;

  // Define a variable to store the file type based on the MIME type
  let fileType;

  if (mimetype.startsWith("video/")) {
    fileType = "video";
  } else if (mimetype.startsWith("audio/")) {
    fileType = "audio";
  } else if (
    mimetype === "application/msword" ||
    mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    fileType = "docx";
  } else if (mimetype === "application/pdf") {
    fileType = "pdf";
  } else if (
    mimetype.startsWith("application/vnd.ms-powerpoint") ||
    mimetype ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    fileType = "ppt";
  } else if (mimetype.startsWith("image/")) {
    fileType = "image";
  } else {
    fileType = "unknown";
  }

  // Check if the uploaded file size, org_id, and file_type are within acceptable limits
  db.query(
    "SELECT file_size FROM tbl_uploadfile_master WHERE org_id = ? AND file_type = ?",
    [org_id, fileType],
    (error, uploadFileResults) => {
      if (error) {
        console.error(error);
        return res.status(500).json({
          error: "Error checking file size and org_id",
        });
      }

      if (uploadFileResults.length === 0) {
        return res.status(400).json({
          error: "File type or org_id is not supported",
        });
      }

      const uploadFileSizeLimit = uploadFileResults[0].file_size;

      // Create a user-specific subdirectory if it doesn't exist
      const userUploadDirectory = `uploads/${id_user}/${fileType}`;
      if (!fs.existsSync(userUploadDirectory)) {
        fs.mkdirSync(userUploadDirectory, { recursive: true });
      }

      // Generate a unique file name to avoid conflicts
      const uniqueFileName = `${Date.now()}-${originalname}`;

      // Save the file within the user's subdirectory
      const filePath = `${userUploadDirectory}/${uniqueFileName}`;
      fs.writeFileSync(filePath, buffer);

      // Insert the file information into tbl_userupload_details
      db.query(
        "INSERT INTO tbl_userupload_details (id_user, org_id, user_id, receivers_id_user, receiver_org_id, receiver_user_id, file_type, file_name, file_path, status, user_message, file_context, sub_type, user_firstname, user_lastname, upload_datetime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id_user,
          org_id,
          user_id,
          receivers_id_user,
          receiver_org_id,
          receiver_user_id,
          fileType,
          originalname,
          filePath,
          "uploaded",
          user_message,
          file_context,
          sub_type,
          user_firstname,
          user_lastname,
          new Date(), // You can adjust this if needed
        ],
        (error, results) => {
          if (error) {
            console.error(error);
            res.status(500).json({ error: "Error uploading the file" });
          } else {
            res.json({
              message: "File uploaded successfully",
              fileId: results.insertId,
            });
          }
        }
      );
    }
  );
});

app.post("/rmuseruploadapi", fileUpload.single("file"), (req, res) => {
  // Extract necessary parameters from the request
  const {
    id_user,
    org_id,
    user_id,
    rtm_id_user,
    rtm_user_id,
    rtm_org_id,
    user_message,
    file_context,
    sub_type,
    user_firstname,
    user_lastname,
  } = req.query;

  // Extract file-related parameters
  const { originalname, mimetype, buffer } = req.file;

  // Define a variable to store the file type based on the MIME type
  let fileType;

  if (mimetype.startsWith("video/")) {
    fileType = "video";
  } else if (mimetype.startsWith("audio/")) {
    fileType = "audio";
  } else if (
    mimetype === "application/msword" ||
    mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    fileType = "docx";
  } else if (mimetype === "application/pdf") {
    fileType = "pdf";
  } else if (
    mimetype.startsWith("application/vnd.ms-powerpoint") ||
    mimetype ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    fileType = "ppt";
  } else if (mimetype.startsWith("image/")) {
    fileType = "image";
  } else {
    fileType = "unknown";
  }

  // Check if the uploaded file size, org_id, and file_type are within acceptable limits
  db.query(
    "SELECT file_size FROM tbl_uploadfile_master WHERE org_id = ? AND file_type = ?",
    [org_id, fileType],
    (error, uploadFileResults) => {
      if (error) {
        console.error(error);
        return res.status(500).json({
          error: "Error checking file size and org_id",
        });
      }

      if (uploadFileResults.length === 0) {
        return res.status(400).json({
          error: "File type or org_id is not supported",
        });
      }

      const uploadFileSizeLimit = uploadFileResults[0].file_size;

      // Create a user-specific subdirectory if it doesn't exist
      const userUploadDirectory = `uploads/${id_user}/${fileType}`;
      if (!fs.existsSync(userUploadDirectory)) {
        fs.mkdirSync(userUploadDirectory, { recursive: true });
      }

      // Generate a unique file name to avoid conflicts
      const uniqueFileName = `${Date.now()}-${originalname}`;

      // Save the file within the user's subdirectory
      const filePath = `${userUploadDirectory}/${uniqueFileName}`;
      fs.writeFileSync(filePath, buffer);

      // Insert the file information into tbl_userupload_details
      db.query(
        "INSERT INTO tbl_userupload_details (id_user, org_id, user_id,  rtm_id_user, rtm_user_id, rtm_org_id, file_type, file_name, file_path, status, user_message, file_context, sub_type, user_firstname, user_lastname, upload_datetime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id_user,
          org_id,
          user_id,
          rtm_id_user,
          rtm_user_id,
          rtm_org_id,
          fileType,
          originalname,
          filePath,
          "uploaded",
          user_message,
          file_context,
          sub_type,
          user_firstname,
          user_lastname,
          new Date(), // You can adjust this if needed
        ],
        (error, results) => {
          if (error) {
            console.error(error);
            res.status(500).json({ error: "Error uploading the file" });
          } else {
            res.json({
              message: "File uploaded successfully",
              fileId: results.insertId,
            });
          }
        }
      );
    }
  );
});

// Create a route to get user upload details with feedback based on id_user, org_id, and user_id
app.get("/getUserUploadDetails", (req, res) => {
  const id_user = req.query.id_user;
  const org_id = req.query.org_id;
  const user_id = req.query.user_id;

  // Retrieve user upload details for the specified user
  db.query(
    "SELECT ud.id_userdetailslog, ud.id_user, ud.org_id, ud.user_id, ud.receivers_id_user, ud.rtm_id_user,ud.file_type, ud.file_name, ud.file_path, ud.user_message, ud.file_context, ud.sub_type, ud.upload_datetime, " +
      "uf.id_feedback, uf.receivers_id_user AS feedback_given_by_id_user, uf.receiver_org_id AS feedback_given_by_org_id, uf.receiver_user_id AS feedback_given_by_user_id, uf.rating, uf.feedback AS user_feedback, uf.feedback_datetime AS feedback_datetime, " +
      "uf.Well_Groomed, uf.Confidence_level, uf.subject_knowledge " +
      "FROM tbl_userupload_details ud " +
      "LEFT JOIN tbl_user_feedback uf ON ud.id_userdetailslog = uf.id_userdetailslog " +
      "WHERE ud.id_user = ? AND ud.org_id = ? AND ud.user_id = ?",
    [id_user, org_id, user_id],
    (error, results) => {
      if (error) {
        console.error(error);
        res.status(500).json({ error: "Error retrieving user upload details" });
      } else {
        // Group the results by user details log
        const userDetailsMap = new Map();
        results.forEach((result) => {
          console.log(result);
          const userDetails = userDetailsMap.get(result.id_userdetailslog) || {
            id_userdetailslog: result.id_userdetailslog,
            id_user: result.id_user,
            org_id: result.org_id,
            user_id: result.user_id,
            receivers_id_user: result.receivers_id_user,
            rtm_id_user: result.rtm_id_user,
            receiver_org_id: result.receiver_org_id,
            receiver_user_id: result.receiver_user_id,
            file_type: result.file_type,
            file_name: result.file_name,
            file_path: `${result.file_path}`, // Adjust the path as needed
            status: result.status,

            user_message: result.user_message,
            file_context: result.file_context,
            sub_type: result.sub_type,
            upload_datetime: result.upload_datetime,
            feedback: [],
          };

          userDetails.feedback.push({
            id_feedback: result.id_feedback,
            feedback_given_by_id_user: result.feedback_given_by_id_user,
            feedback_given_by_org_id: result.feedback_given_by_org_id,
            feedback_given_by_user_id: result.feedback_given_by_user_id,
            rating: result.rating,
            user_feedback: result.user_feedback,
            feedback_datetime: result.feedback_datetime,
            Well_Groomed: result.Well_Groomed,
            Confidence_level: result.Confidence_level,
            subject_knowledge: result.subject_knowledge,
          });

          userDetailsMap.set(result.id_userdetailslog, userDetails);
        });

        // Convert the Map values to an array
        const userDetailsArray = Array.from(userDetailsMap.values());
        res.json(userDetailsArray);
      }
    }
  );
});

// Create a route to retrieve uploaded files for a particular user using the id_user
app.get(
  "/getuserupload/:receivers_id_user/:receiver_org_id/:receiver_user_id",
  (req, res) => {
    const receivers_id_user = req.params.receivers_id_user;
    const receiver_org_id = req.params.receiver_org_id;
    const receiver_user_id = req.params.receiver_user_id;

    // Retrieve uploaded files and associated feedback
    db.query(
      "SELECT ud.id_userdetailslog, ud.id_user, ud.org_id, ud.user_id, ud.file_context, ud.sub_type, ud.file_type, ud.file_name, ud.file_path, ud.user_firstname, ud.user_lastname, ud.user_message, ud.upload_datetime, " +
        "uf.id_feedback, uf.receivers_id_user AS feedback_given_by_id_user, uf.receiver_org_id AS feedback_given_by_org_id, uf.receiver_user_id AS feedback_given_by_user_id, uf.rating, uf.feedback AS user_feedback, uf.feedback_datetime AS feedback_datetime, " +
        "uf.Well_Groomed, uf.Confidence_level, uf.subject_knowledge " +
        "FROM tbl_userupload_details ud " +
        "LEFT JOIN tbl_user_feedback uf ON ud.id_userdetailslog = uf.id_userdetailslog " +
        "WHERE ud.receivers_id_user = ? AND ud.receiver_org_id = ? AND ud.receiver_user_id = ? " +
        "AND (uf.receivers_id_user = ? OR uf.receivers_id_user IS NULL) " +
        "AND (uf.receiver_org_id = ? OR uf.receiver_org_id IS NULL) " +
        "AND (uf.receiver_user_id = ? OR uf.receiver_user_id IS NULL)",
      [
        receivers_id_user,
        receiver_org_id,
        receiver_user_id,
        receivers_id_user,
        receiver_org_id,
        receiver_user_id,
      ],
      (error, results) => {
        if (error) {
          console.error(error);
          res.status(500).json({ error: "Error retrieving uploaded files" });
        } else {
          // Modify the results to include the file paths relative to the "uploads" directory
          const files = results.map((file) => {
            return {
              id_userdetailslog: file.id_userdetailslog,
              file_type: file.file_type,
              file_name: file.file_name,
              file_context: file.file_context,
              sub_type: file.sub_type,
              upload_datetime: file.upload_datetime,
              file_path: `${file.file_path}`, // Adjust the path as needed
              user_firstname: file.user_firstname,
              user_lastname: file.user_lastname,
              user_message: file.user_message,
              feedback: {
                id_feedback: file.id_feedback,
                feedback_given_by_id_user: file.feedback_given_by_id_user,
                feedback_given_by_org_id: file.feedback_given_by_org_id,
                feedback_given_by_user_id: file.feedback_given_by_user_id,
                rating: file.rating,
                user_feedback: file.user_feedback,
                feedback_datetime: file.feedback_datetime,
                Well_Groomed: file.Well_Groomed,
                Confidence_level: file.Confidence_level,
                subject_knowledge: file.subject_knowledge,
              },
            };
          });

          res.json(files);
        }
      }
    );
  }
);

app.get(
  "/getuseruploadrtm/:rtm_id_user/:rtm_org_id/:rtm_user_id",
  (req, res) => {
    const rtm_id_user = req.params.rtm_id_user;
    const rtm_org_id = req.params.rtm_org_id;
    const rtm_user_id = req.params.rtm_user_id;

    // Retrieve uploaded files and associated feedback
    db.query(
      "SELECT ud.id_userdetailslog, ud.id_user, ud.org_id, ud.user_id, ud.file_context, ud.sub_type, ud.file_type, ud.file_name, ud.file_path, ud.user_firstname, ud.user_lastname, ud.user_message, ud.upload_datetime, " +
        "uf.id_feedback, uf.receivers_id_user AS feedback_given_by_id_user, uf.receiver_org_id AS feedback_given_by_org_id, uf.receiver_user_id AS feedback_given_by_user_id, uf.rating, uf.feedback AS user_feedback, uf.feedback_datetime AS feedback_datetime, " +
        "uf.Well_Groomed, uf.Confidence_level, uf.subject_knowledge " +
        "FROM tbl_userupload_details ud " +
        "LEFT JOIN tbl_user_feedback uf ON ud.id_userdetailslog = uf.id_userdetailslog " +
        "WHERE ud.rtm_id_user = ? AND ud.rtm_org_id = ? AND ud.rtm_user_id = ? " +
        "AND (uf.receivers_id_user = ? OR uf.receivers_id_user IS NULL) " +
        "AND (uf.receiver_org_id = ? OR uf.receiver_org_id IS NULL) " +
        "AND (uf.receiver_user_id = ? OR uf.receiver_user_id IS NULL)",
      [
        rtm_id_user,
        rtm_org_id,
        rtm_user_id,
        rtm_id_user,
        rtm_org_id,
        rtm_user_id,
      ],
      (error, results) => {
        if (error) {
          console.error(error);
          res.status(500).json({ error: "Error retrieving uploaded files" });
        } else {
          // Modify the results to include the file paths relative to the "uploads" directory
          const files = results.map((file) => {
            return {
              id_userdetailslog: file.id_userdetailslog,
              file_type: file.file_type,
              file_name: file.file_name,
              file_context: file.file_context,
              sub_type: file.sub_type,
              upload_datetime: file.upload_datetime,
              file_path: `${file.file_path}`, // Adjust the path as needed
              user_firstname: file.user_firstname,
              user_lastname: file.user_lastname,
              user_message: file.user_message,
              feedback: {
                id_feedback: file.id_feedback,
                feedback_given_by_id_user: file.feedback_given_by_id_user,
                feedback_given_by_org_id: file.feedback_given_by_org_id,
                feedback_given_by_user_id: file.feedback_given_by_user_id,
                rating: file.rating,
                user_feedback: file.user_feedback,
                feedback_datetime: file.feedback_datetime,
                Well_Groomed: file.Well_Groomed,
                Confidence_level: file.Confidence_level,
                subject_knowledge: file.subject_knowledge,
              },
            };
          });

          res.json(files);
        }
      }
    );
  }
);

// Create a route to get details from tbl_userupload_details based on receivers_id_user, receiver_org_id, and receiver_user_id

// Create a route to post feedback for a specific file based on id_userdetailslog
app.post("/postFeedbackForFile", (req, res) => {
  const {
    id_type,
    id_value,
    id_userdetailslog,
    feedback,
    rating,
    Well_Groomed,
    Confidence_level,
    subject_knowledge,
    file_context,
    sub_type,
  } = req.body;

  if (!id_userdetailslog || !feedback || !file_context || !sub_type) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  let idFields;
  let idValues;

  // Determine the id fields based on id_type
  if (id_type === "receivers") {
    idFields = ["receivers_id_user", "receiver_org_id", "receiver_user_id"];
  } else if (id_type === "rtm") {
    idFields = ["rtm_id_user", "rtm_org_id", "rtm_user_id"];
  } else {
    return res.status(400).json({ error: "Invalid id_type" });
  }

  // Extract id values from id_value
  idValues = id_value.split("/");

  // Check if the user has permission to provide feedback for this file
  db.query(
    `SELECT id_user, org_id, user_id FROM tbl_userupload_details WHERE id_userdetailslog = ? AND ${idFields
      .map((field) => `${field} = ?`)
      .join(" AND ")}`,
    [id_userdetailslog, ...idValues],
    (error, results) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ error: "Error checking permission" });
      }

      if (results.length === 0) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const { id_user, org_id, user_id } = results[0];

      // Insert feedback into tbl_feedback
      db.query(
        "INSERT INTO tbl_user_feedback (id_userdetailslog, receivers_id_user, receiver_org_id, receiver_user_id, feedback, feedback_datetime, given_by_id_user, given_by_org_id, given_by_user_id, rating,  Well_Groomed,Confidence_level,subject_knowledge,file_context, sub_type) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?,?, ?, ?, ?)",
        [
          id_userdetailslog,
          ...idValues,
          feedback,
          id_user,
          org_id,
          user_id,
          rating,
          Well_Groomed,
          Confidence_level,
          subject_knowledge,
          file_context,
          sub_type,
        ],
        (error, feedbackResults) => {
          if (error) {
            console.error(error);
            res.status(500).json({ error: "Error posting feedback" });
          } else {
            res.json({
              message: "Feedback posted successfully",
              feedbackId: feedbackResults.insertId,
            });
          }
        }
      );
    }
  );
});

// Create a route to get feedback for a specific user
app.get("/getFeedbackForUser", (req, res) => {
  const receivers_id_user = req.query.receivers_id_user;
  const receiver_org_id = req.query.receiver_org_id;
  const receiver_user_id = req.query.receiver_user_id;

  // Check if the user has feedback
  db.query(
    "SELECT id_feedback, id_userdetailslog, given_by_id_user, given_by_org_id, given_by_user_id ,rating, file_context, sub_type, feedback, feedback_datetime FROM tbl_user_feedback WHERE receivers_id_user = ? AND receiver_org_id = ? AND receiver_user_id = ?",
    [receivers_id_user, receiver_org_id, receiver_user_id],
    (error, results) => {
      if (error) {
        console.error(error);
        res.status(500).json({ error: "Error retrieving feedback" });
      } else {
        res.json(results);
      }
    }
  );
});

// Create a route to get details from tbl_userupload_details based on receivers_id_user, receiver_org_id, and receiver_user_id
app.get(
  "/getUserDetailsByReceivers/:receivers_id_user/:receiver_org_id/:receiver_user_id",
  (req, res) => {
    const receivers_id_user = req.params.receivers_id_user;
    const receiver_org_id = req.params.receiver_org_id;
    const receiver_user_id = req.params.receiver_user_id;

    // Retrieve details from tbl_userupload_details
    db.query(
      "SELECT id_userdetailslog, id_user, org_id, user_id FROM tbl_userupload_details WHERE receivers_id_user = ? AND receiver_org_id = ? AND receiver_user_id = ?",
      [receivers_id_user, receiver_org_id, receiver_user_id],
      (error, results) => {
        if (error) {
          console.error(error);
          res.status(500).json({ error: "Error retrieving user details" });
        } else {
          res.json(results);
        }
      }
    );
  }
);

app.post("/uploadExcel", excelUpload.single("excelFile"), (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No Excel file provided" });
  }

  // Parse the Excel file
  const workbook = xlsx.read(file.buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  // Insert data into tbl_user_upload_log
  const insertQuery =
    "INSERT INTO tbl_user_upload_log (org_id, id_user, user_id, user_firstname, user_lastname, level1_role_id, level1_role, level3_id_user, level3_user_id, level3_firstname, level3_lastname, level3_role_id, level3_role, level4_id_user, level4_user_id, level4_firstname, level4_lastname, level4_role_id, level4_role, updated_datetime) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)";

  // Use a transaction to ensure all or none of the data is inserted
  db.beginTransaction((err) => {
    if (err) {
      console.error("Error starting transaction:", err);
      return res.status(500).json({ error: "Error uploading Excel file" });
    }

    // Batch insert size, you can adjust this based on your needs
    const batchSize = 100;

    // Insert data in batches
    for (let i = 0; i < sheetData.length; i += batchSize) {
      const batch = sheetData.slice(i, i + batchSize);

      batch.forEach((row) => {
        const values = [
          row.org_id,
          row.id_user,
          row.user_id,
          row.user_firstname,
          row.user_lastname,
          row.level1_role_id,
          row.level1_role,
          row.level3_id_user,
          row.level3_user_id,
          row.level3_firstname,
          row.level3_lastname,
          row.level3_role_id,
          row.level3_role,
          row.level4_id_user,
          row.level4_user_id,
          row.level4_firstname,
          row.level4_lastname,
          row.level4_role_id,
          row.level4_role,
        ];

        db.query(insertQuery, values, (error) => {
          if (error) {
            console.error(
              "Error inserting row into tbl_user_upload_log:",
              error
            );
            return db.rollback(() => {
              res.status(500).json({ error: "Error uploading Excel file" });
            });
          }
        });
      });
    }

    // Commit the transaction
    db.commit((error) => {
      if (error) {
        console.error("Error committing transaction:", error);
        return db.rollback(() => {
          res.status(500).json({ error: "Error uploading Excel file" });
        });
      }

      res.json({
        message: "Excel file uploaded and data inserted successfully",
      });
    });
  });
});

// Create a route to get manager details based on id_user, user_id, and org_id
app.post("/getManagerDetails", (req, res) => {
  const { id_user, user_id, org_id } = req.body;

  if (!id_user || !user_id || !org_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Retrieve manager details for the specified user
  const query =
    "SELECT user_id, user_firstname, user_lastname, level1_role_id, level1_role, level3_id_user, level3_user_id, level3_firstname, level3_lastname, level3_role_id, level3_role,level4_id_user, level4_user_id, level4_firstname, level4_lastname, level4_role_id, level4_role " +
    "FROM tbl_user_upload_log " +
    "WHERE id_user = ? AND user_id = ? AND org_id = ?";

  db.query(query, [id_user, user_id, org_id], (error, results) => {
    if (error) {
      console.error(error);
      res.status(500).json({ error: "Error retrieving manager details" });
    } else {
      if (results.length === 0) {
        res.status(404).json({ error: "Manager details not found" });
      } else {
        const managerDetails = results[0];
        res.json(managerDetails);
      }
    }
  });
});

// Create a route to get manager details based on id_user, user_id, and org_id
app.post("/getRoleDetails", (req, res) => {
  const { id_user, user_id, org_id } = req.body;

  if (!id_user || !user_id || !org_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Initialize variables to store role IDs
  let level1RoleId = null;
  let level3RoleId = null;
  let level4RoleId = null;

  // Retrieve level1_role_id for the specified user
  const queryLevel1 =
    "SELECT level1_role_id " +
    "FROM tbl_user_upload_log " +
    "WHERE id_user = ? AND user_id = ? AND org_id = ?";

  // Retrieve level3_role_id for the specified user
  const queryLevel3 =
    "SELECT level3_role_id " +
    "FROM tbl_user_upload_log " +
    "WHERE level3_id_user = ? AND level3_user_id = ? AND org_id = ?";

  // Retrieve level4_role_id for the specified user
  const queryLevel4 =
    "SELECT level4_role_id " +
    "FROM tbl_user_upload_log " +
    "WHERE level4_id_user = ? AND level4_user_id = ? AND org_id = ?";

  // Execute queries in parallel using Promise.all
  Promise.all([
    executeQuery(queryLevel1, [id_user, user_id, org_id]),
    executeQuery(queryLevel3, [id_user, user_id, org_id]),
    executeQuery(queryLevel4, [id_user, user_id, org_id]),
  ])
    .then((results) => {
      // Extract results from each query
      level1RoleId = results[0][0]?.level1_role_id;
      level3RoleId = results[1][0]?.level3_role_id;
      level4RoleId = results[2][0]?.level4_role_id;

      // Filter out null values
      const nonNullRoleIds = [level1RoleId, level3RoleId, level4RoleId].filter(
        (roleId) => roleId !== null
      );

      // Build the response
      const RoleID = nonNullRoleIds.join("");

      // Check if RoleID is not empty
      if (RoleID) {
        res.json({ RoleID });
      } else {
        res.status(404).json({ error: "No role details found" });
      }
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ error: "Error retrieving role details" });
    });
});

// Function to execute a query with parameters
function executeQuery(query, params) {
  return new Promise((resolve, reject) => {
    db.query(query, params, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

// Function to execute a query with parameters
function executeQuery(query, params) {
  return new Promise((resolve, reject) => {
    db.query(query, params, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

//Code Of Ethics Code
app.post("/postCodeOfEthicLog", (req, res) => {
  const { user_id, user_response } = req.body;

  if (!user_id || !user_response) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Create a new entry in tbl_code_of_ethic_log
  const insertQuery =
    "INSERT INTO tbl_code_of_ethic_log (user_id, user_response, updated_datetime) VALUES (?, ?, CURRENT_TIMESTAMP)";

  db.query(insertQuery, [user_id, user_response], (error, results) => {
    if (error) {
      console.error("Error inserting into tbl_code_of_ethic_log:", error);
      res.status(500).json({ error: "Error posting code of ethic log" });
    } else {
      res.json({
        message: "Code of ethic log posted successfully",
        logId: results.insertId,
      });
    }
  });
});

app.get("/getCodeOfEthicLogs", (req, res) => {
  // Retrieve all entries from tbl_code_of_ethic_log
  const selectQuery =
    "SELECT id_code_of_ethic, user_id, user_response, updated_datetime FROM tbl_code_of_ethic_log";

  db.query(selectQuery, (error, results) => {
    if (error) {
      console.error("Error retrieving code of ethic logs:", error);
      res.status(500).json({ error: "Error retrieving code of ethic logs" });
    } else {
      res.json(results);
    }
  });
});

const server = https.createServer(httpsOptions, app).listen(6000, () => {
  console.log("Server running on https://localhost:6000/");
});

// app.listen(port, () => {
//   console.log(`Server is running on port ${port}`);
// });
