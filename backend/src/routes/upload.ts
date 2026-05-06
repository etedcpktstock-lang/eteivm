import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';

const router = Router();

type UploadRequest = Request & { file?: Express.Multer.File };

// Set storage engine
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (_req: UploadRequest, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

// Check file type
function checkFileType(file: Express.Multer.File, cb: FileFilterCallback): void {
  const filetypes = /jpeg|jpg|png|gif/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error('Error: Images Only!'));
  }
}

// Init upload
const upload = multer({
  storage,
  limits: { fileSize: 10_000_000 }, // 10MB
  fileFilter: (_req: UploadRequest, file: Express.Multer.File, cb: FileFilterCallback) => {
    checkFileType(file, cb);
  }
}).single('image'); // Expecting field name 'image'

// @route   POST /api/upload
// @desc    Upload an image
// @access  Public (or protect with auth if needed)
router.post('/', (req: Request, res: Response) => {
  upload(req as UploadRequest, res, (err?: any) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || String(err) });
    }

    const r = req as UploadRequest;
    if (!r.file) {
      return res.status(400).json({ success: false, message: 'Error: No File Selected!' });
    }

    const imageUrl = `/uploads/${r.file.filename}`;
    return res.json({ success: true, imageUrl, filename: r.file.filename });
  });
});

export default router;
