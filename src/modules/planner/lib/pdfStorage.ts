import { supabase } from '@/config/supabase'

export interface PDFBlob {
    id: string
    courseId: string
    fileName: string
    mimeType: string
    fileSize: number
    uploadedAt: string
    storagePath?: string
}

export interface UploadProgress {
    loaded: number
    total: number
    percentage: number
}

export type UploadProgressCallback = (progress: UploadProgress) => void

const BUCKET = 'course-materials'
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
const SIGNED_URL_TTL_SECONDS = 60

function toPDFBlob(row: {
    id: string
    course_id: string
    file_name: string
    mime_type: string
    file_size: number
    storage_path: string
    created_at: string
}): PDFBlob {
    return {
        id: row.id,
        courseId: row.course_id,
        fileName: row.file_name,
        mimeType: row.mime_type,
        fileSize: row.file_size,
        uploadedAt: row.created_at,
        storagePath: row.storage_path,
    }
}

async function requireUserId(): Promise<string> {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) {
        throw new Error('Not authenticated')
    }
    return data.user.id
}

export async function uploadPDF(
    file: File,
    courseId: string,
    onProgress?: UploadProgressCallback
): Promise<{ id: string; fileName: string; fileSize: number }> {
    if (file.type !== 'application/pdf') {
        throw new Error('Only PDF files are supported')
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new Error('File exceeds the 50MB limit')
    }

    const userId = await requireUserId()
    const storagePath = `${userId}/${courseId}/${Date.now()}_${file.name}`

    onProgress?.({ loaded: 0, total: file.size, percentage: 0 })

    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { contentType: file.type })
    if (uploadError) {
        throw uploadError
    }

    const { data: row, error: insertError } = await supabase
        .from('course_materials')
        .insert({
            user_id: userId,
            course_id: courseId,
            file_name: file.name,
            mime_type: file.type,
            file_size: file.size,
            storage_path: storagePath,
        })
        .select()
        .single()

    if (insertError || !row) {
        await supabase.storage.from(BUCKET).remove([storagePath])
        throw insertError ?? new Error('Failed to save uploaded file')
    }

    onProgress?.({ loaded: file.size, total: file.size, percentage: 100 })

    return { id: row.id, fileName: row.file_name, fileSize: row.file_size }
}

export async function getPDFBlob(id: string): Promise<PDFBlob | undefined> {
    const { data, error } = await supabase
        .from('course_materials')
        .select()
        .eq('id', id)
        .maybeSingle()

    if (error || !data) {
        return undefined
    }
    return toPDFBlob(data)
}

export async function getCoursePDFs(courseId: string): Promise<PDFBlob[]> {
    const { data, error } = await supabase
        .from('course_materials')
        .select()
        .eq('course_id', courseId)
        .order('created_at', { ascending: false })

    if (error || !data) {
        return []
    }
    return data.map(toPDFBlob)
}

async function getSignedUrl(storagePath: string, download?: string | boolean) {
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS, download ? { download } : undefined)
    if (error || !data) {
        throw error ?? new Error('Failed to create signed URL')
    }
    return data.signedUrl
}

export async function openPDFInNewTab(id: string): Promise<void> {
    const blob = await getPDFBlob(id)
    if (!blob?.storagePath) {
        throw new Error('File not found')
    }
    const url = await getSignedUrl(blob.storagePath)
    window.open(url, '_blank', 'noopener,noreferrer')
}

export async function downloadPDF(id: string): Promise<void> {
    const blob = await getPDFBlob(id)
    if (!blob?.storagePath) {
        throw new Error('File not found')
    }
    const url = await getSignedUrl(blob.storagePath, blob.fileName)
    const link = document.createElement('a')
    link.href = url
    link.download = blob.fileName
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
}

export async function deletePDF(id: string): Promise<void> {
    const blob = await getPDFBlob(id)
    if (!blob?.storagePath) {
        return
    }
    await supabase.storage.from(BUCKET).remove([blob.storagePath])
    await supabase.from('course_materials').delete().eq('id', id)
}

export async function deleteCoursePDFs(courseId: string): Promise<void> {
    const pdfs = await getCoursePDFs(courseId)
    if (pdfs.length === 0) {
        return
    }
    const paths = pdfs.map(p => p.storagePath).filter((p): p is string => !!p)
    if (paths.length > 0) {
        await supabase.storage.from(BUCKET).remove(paths)
    }
    await supabase.from('course_materials').delete().eq('course_id', courseId)
}

export async function getTotalStorageUsed(): Promise<number> {
    const userId = await requireUserId()
    const { data, error } = await supabase
        .from('course_materials')
        .select('file_size')
        .eq('user_id', userId)

    if (error || !data) {
        return 0
    }
    return data.reduce((sum, row) => sum + row.file_size, 0)
}

export async function getLastUploadedPDF(courseId: string): Promise<PDFBlob | undefined> {
    const { data, error } = await supabase
        .from('course_materials')
        .select()
        .eq('course_id', courseId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error || !data) {
        return undefined
    }
    return toPDFBlob(data)
}

export async function cleanupOrphanPDFs(activeCourseIds: string[]): Promise<number> {
    const userId = await requireUserId()
    let query = supabase
        .from('course_materials')
        .select()
        .eq('user_id', userId)

    if (activeCourseIds.length > 0) {
        query = query.not('course_id', 'in', `(${activeCourseIds.join(',')})`)
    }

    const { data, error } = await query
    if (error || !data || data.length === 0) {
        return 0
    }

    const paths = data.map(row => row.storage_path).filter((p): p is string => !!p)
    if (paths.length > 0) {
        await supabase.storage.from(BUCKET).remove(paths)
    }
    await supabase
        .from('course_materials')
        .delete()
        .in('id', data.map(row => row.id))

    return data.length
}
