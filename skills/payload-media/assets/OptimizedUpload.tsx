'use client'

import { Upload, useDocumentInfo, useField } from '@payloadcms/ui'
import { useCallback, useRef } from 'react'

import { optimizeImage } from './optimizeImage'

// Replaces the default upload control on an upload collection's edit view.
// The selected image is optimized in the browser, then written back to the form's `file` field,
// so the optimized file is what gets uploaded (including direct client uploads to storage).
export function OptimizedUpload() {
  const { collectionSlug, docConfig, initialState } = useDocumentInfo()
  const { setValue } = useField<File | null>({ path: 'file' })
  const produced = useRef(new Set<number>())

  const handleChange = useCallback(
    async (file?: File) => {
      // Renaming a file in the admin calls onChange again with a copy that keeps lastModified.
      if (!file || produced.current.has(file.lastModified)) return
      const optimized = await optimizeImage(file)
      if (optimized === file) return
      produced.current.add(optimized.lastModified)
      setValue(optimized)
    },
    [setValue],
  )

  if (!collectionSlug || !docConfig || !('upload' in docConfig)) return null

  return (
    <Upload
      collectionSlug={collectionSlug}
      initialState={initialState}
      uploadConfig={docConfig.upload}
      onChange={(file) => {
        void handleChange(file)
      }}
    />
  )
}
