const shortid = require("shortid");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
console.log(process.env.SECRET_ACCESS_KEY)
const s3Client = new S3Client({
  region: "us-east-1", // Replace with your region
  credentials: {
    accessKeyId: "EIY10XXI3SVFYW5QEF4D", // Replace with your Access Key
    secretAccessKey: process.env.SECRET_ACCESS_KEY, // Replace with your Secret Key
  },
  endpoint: "https://drlab.us-east-1.linodeobjects.com", // Linode Object Storage endpoint
  forcePathStyle: true, // Required for S3-compatible storage
});

const uploadToLinode = async (files, phone) => {
  if (!files || Object.keys(files).length === 0) {
    return res.status(400).send("No files were uploaded.");
  }

  const file = files.file;
  const bucketName = "files"; // Replace with your bucket name
  const objectName = `${phone}-${shortid.generate().slice(0, 6)}`; // Generate the file name

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectName,
      Body: file.data,
      ContentType: file.mimetype,
      ACL: "public-read", // Make the file publicly accessible
    });

    await s3Client.send(command);

    const fileUrl = `${bucketName}/${objectName}`;
    return fileUrl;
  } catch (error) {
    console.error("File upload failed:", error);
  }
};

module.exports = { uploadToLinode };
