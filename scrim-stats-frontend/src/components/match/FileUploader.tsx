import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Typography, List, ListItem, ListItemIcon, ListItemText, Paper, IconButton } from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface FileUploaderProps {
  formik: any;
}

const FileUploader: React.FC<FileUploaderProps> = ({ formik }) => {
  const { values, setFieldValue } = formik;
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Add new files to the existing files array
    setFieldValue('files', [...values.files, ...acceptedFiles]);
  }, [values.files, setFieldValue]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'application/pdf': []
    }
  });
  
  const removeFile = (index: number) => {
    const newFiles = [...values.files];
    newFiles.splice(index, 1);
    setFieldValue('files', newFiles);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>Match Evidence Uploads</Typography>
      
      {/* Dropzone */}
      <Paper
        sx={{
          p: 3,
          mb: 2,
          textAlign: 'center',
          backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
          border: '2px dashed',
          borderColor: isDragActive ? 'primary.main' : 'divider',
          cursor: 'pointer'
        }}
        {...getRootProps()}
      >
        <input {...getInputProps()} />
        <CloudUploadIcon color="primary" sx={{ fontSize: 48, mb: 1 }} />
        <Typography>
          {isDragActive
            ? 'Drop the files here...'
            : 'Drag & drop files here, or click to select files'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Supported formats: JPEG, PNG, PDF
        </Typography>
      </Paper>
      
      {/* File list */}
      {values.files.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            {values.files.length} file(s) ready to upload
          </Typography>
          
          <List>
            {values.files.map((file: File, index: number) => (
              <ListItem
                key={index}
                secondaryAction={
                  <IconButton edge="end" onClick={() => removeFile(index)}>
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <ListItemIcon>
                  <InsertDriveFileIcon />
                </ListItemIcon>
                <ListItemText
                  primary={file.name}
                  secondary={`${(file.size / 1024).toFixed(2)} KB`}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
};

export default FileUploader; 