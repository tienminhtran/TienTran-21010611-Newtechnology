const express = require("express");
const bodyParser = require("body-parser");
const AWS = require("aws-sdk");
const path = require("path");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", "./views");

// Cấu hình AWS DynamoDB
AWS.config.update({
    region: "ap-southeast-1",
    credentials: {

    },
});

const docClient = new AWS.DynamoDB.DocumentClient();
const table = "SanPham";

// 🟢 Route GET: Hiển thị danh sách sản phẩm
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

// 🟢 Route POST: Thêm sản phẩm
app.post("/", (req, res) => {
    const { ma_sp, ten_sp, so_luong } = req.body;

    const params = {
        TableName: table,
        Item: {
            ma_sp: Number(ma_sp),
            ten_sp: ten_sp,
            so_luong: Number(so_luong),
        },
    };

    docClient.put(params, (err) => {
        if (err) {
            console.error("Lỗi khi thêm sản phẩm:", err);
            return res.send("Lỗi khi thêm sản phẩm!");
        } else {
            console.log("Thêm thành công:", params.Item);
            return res.redirect("/");
        }
    });
});

// 🟢 Route DELETE: Xóa sản phẩm theo danh sách đã chọn
app.post("/delete", (req, res) => {
    const selectedItems = req.body.selectedItems;

    if (!selectedItems) {
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
