require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const AWS = require("aws-sdk");
const path = require("path");
const { v4: uuid } = require("uuid");
const multer = require("multer");
const s3 = new AWS.S3();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", "./views");

// Cấu hình Multer để xử lý hình ảnh
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 2000000 }, // 2MB
    fileFilter: (req, file, cb) => {
        const fileTypes = /jpeg|jpg|png|gif/;
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = fileTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        }
        return cb(new Error("Chỉ chấp nhận hình ảnh!"));
    },
});

// Cấu hình AWS DynamoDB
AWS.config.update({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const docClient = new AWS.DynamoDB.DocumentClient();
const table = "SanPham";
const cloudFrontDomain = "https://d1wg7c6k5m1zbb.cloudfront.net";

// Route GET: Hiển thị danh sách sản phẩm
app.get("/", (req, res) => {
    const params = { TableName: table };

    docClient.scan(params, (err, data) => {
        if (err) {
            return res.send("Lỗi khi truy vấn dữ liệu");
        } else {
            return res.render("index", { items: data.Items });
        }
    });
});

// Route POST: Thêm sản phẩm
app.post("/", upload.single("hinh_anh"), (req, res) => {
    const { ma_sp, ten_sp, so_luong } = req.body;

    if (!req.file) {
        return res.send("Lỗi: Không có hình ảnh tải lên!");
    }

    const image = req.file.originalname.split(".");
    const fileType = image[image.length - 1];
    const filePath = `${uuid()}-${Date.now().toString()}.${fileType}`;

    const params = {
        Bucket: "tien21010611",
        Key: filePath,
        Body: req.file.buffer,
    };

    s3.upload(params, (err, data) => {
        if (err) {
            console.error("Lỗi khi tải lên S3:", err);
            return res.send("Lỗi khi tải lên S3!");
        } else {
            const newItem = {
                TableName: table,
                Item: {
                    ma_sp: Number(ma_sp),
                    ten_sp,
                    so_luong: Number(so_luong),
                    hinh_anh: `${cloudFrontDomain}/${filePath}`,
                },
            };

            docClient.put(newItem, (err) => {
                if (err) {
                    console.error("Lỗi khi thêm sản phẩm:", err);
                    console.log("Dữ liệu từ DynamoDB1:", data.Item);
                    return res.send("Lỗi khi thêm sản phẩm!");
                    
                } else {
                    console.log("Thêm thành công:", newItem.Item);
                    console.log("Dữ liệu từ DynamoDB2:", data);
                    return res.redirect("/");
                }
            });
        }
    });
});

// Route DELETE: Xóa sản phẩm
app.post("/delete", (req, res) => {
    const selectedItems = req.body.selectedItems;

    if (!selectedItems || selectedItems.length === 0) {
        return res.redirect("/");
    }

    const itemsToDelete = Array.isArray(selectedItems) ? selectedItems : [selectedItems];

    console.log("Danh sách sản phẩm cần xóa:", itemsToDelete);

    function deleteItem(index) {
        if (index < 0) {
            return res.redirect("/");
        }

        const params = {
            TableName: table,
            Key: { ma_sp: Number(itemsToDelete[index]) },
        };

        docClient.delete(params, (err) => {
            if (err) {
                console.error("Lỗi khi xóa sản phẩm:", err);
                return res.send("Lỗi khi xóa sản phẩm!");
            } else {
                console.log("Đã xóa:", itemsToDelete[index]);
                deleteItem(index - 1);
            }
        });
    }

    deleteItem(itemsToDelete.length - 1);
});

// Khởi động server
app.listen(3000, () => {
    console.log("Server is running on port 3000!");
});
