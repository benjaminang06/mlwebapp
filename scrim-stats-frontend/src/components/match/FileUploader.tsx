import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Typography, List, ListItem, ListItemIcon, ListItemText, Paper, IconButton } from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface FileUploaderProps {
  onChange: (files: File[]) => void;
  maxFiles?: number;
  acceptedFileTypes?: string[];
  formik?: any; // Keep for backwards compatibility
}

const FileUploader: React.FC<FileUploaderProps> = ({ 
  onChange, 
  maxFiles = 5, 
  acceptedFileTypes = ['image/jpeg', 'image/png', 'application/pdf'],
  formik 
}) => {
  const [files, setFiles] = useState<File[]>([]);
  
  // For backward compatibility
  const { values, setFieldValue } = formik || { values: { files: [] }, setFieldValue: () => {} };
  const currentFiles = formik ? values.files : files;
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Check if adding these files would exceed maxFiles
    if (currentFiles.length + acceptedFiles.length > maxFiles) {
      // Slice to only take what we can fit
      acceptedFiles = acceptedFiles.slice(0, maxFiles - currentFiles.length);
      // You could show a notification here that some files were dropped
    }
    
    // Add new files to the existing files array
    const newFiles = [...currentFiles, ...acceptedFiles];
    
    if (formik) {
      setFieldValue('files', newFiles);
    } else {
      setFiles(newFiles);
      onChange(newFiles);
    }
  }, [currentFiles, formik, maxFiles, onChange, setFieldValue]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes.reduce((acc, type) => {
      acc[type] = [];
      return acc;
    }, {} as Record<string, string[]>)
  });
  
  const removeFile = (index: number) => {
    const newFiles = [...currentFiles];
    newFiles.splice(index, 1);
    
    if (formik) {
      setFieldValue('files', newFiles);
    } else {
      setFiles(newFiles);
      onChange(newFiles);
    }
  };

  const getFileTypesText = () => {
    const typeLabels = acceptedFileTypes.map(type => {
      // Convert MIME types to readable format
      return type.split('/')[1].toUpperCase();
    });
    return typeLabels.join(', ');
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
            : `Drag & drop files here, or click to select files (max ${maxFiles})`}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Supported formats: {getFileTypesText()}
        </Typography>
      </Paper>
      
      {/* File list */}
      {currentFiles.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            {currentFiles.length} file(s) ready to upload
          </Typography>
          
          <List>
            {currentFiles.map((file: File, index: number) => (
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