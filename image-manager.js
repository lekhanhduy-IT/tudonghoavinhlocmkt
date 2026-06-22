/**
 * IMAGE MANAGER - Quản lý ảnh cho Blog Editor
 * Features: Upload, Metadata, Clipboard, Google Drive Integration
 */

// ============================================================
// CONFIG
// ============================================================
const IMAGE_CONFIG = {
    DRIVE_FOLDER_ID: '11ad-tiEWqSeJdm0kv_q-_b2x0qWD9b6b',
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    DEFAULT_AUTHOR: 'Tu Dong Hoa Vinh Loc',
    DEFAULT_COPYRIGHT: 'tudonghoavinhloc.com',
    CACHE_KEY_PREFIX: 'vb_img_cache_'
};

// ============================================================
// IMAGE METADATA STORE (Local + sessionStorage)
// ============================================================
class ImageMetadataStore {
    constructor() {
        this.store = new Map();
        this.loadFromStorage();
    }

    generateImageId() {
        return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    set(imgId, metadata) {
        this.store.set(imgId, {
            imgId,
            width: metadata.width || 'auto',
            height: metadata.height || 'auto',
            aspectRatio: metadata.aspectRatio || null,
            fileName: metadata.fileName || 'image.jpg',
            altText: metadata.altText || '',
            caption: metadata.caption || '',
            title: metadata.title || '',
            description: metadata.description || '',
            author: metadata.author || IMAGE_CONFIG.DEFAULT_AUTHOR,
            copyright: metadata.copyright || IMAGE_CONFIG.DEFAULT_COPYRIGHT,
            url: metadata.url || '',
            createdAt: metadata.createdAt || new Date().toISOString(),
        });
        this.saveToStorage();
    }

    get(imgId) {
        return this.store.get(imgId);
    }

    delete(imgId) {
        this.store.delete(imgId);
        this.saveToStorage();
    }

    saveToStorage() {
        const data = Array.from(this.store.entries());
        sessionStorage.setItem('vb_image_metadata', JSON.stringify(data));
    }

    loadFromStorage() {
        try {
            const data = JSON.parse(sessionStorage.getItem('vb_image_metadata') || '[]');
            this.store = new Map(data);
        } catch (e) {
            console.warn('Failed to load image metadata from storage', e);
        }
    }

    getAll() {
        return Array.from(this.store.values());
    }

    clone(imgId) {
        const original = this.get(imgId);
        if (!original) return null;
        const newId = this.generateImageId();
        this.set(newId, { ...original, imgId: newId });
        return newId;
    }
}

const imageMetadataStore = new ImageMetadataStore();

// ============================================================
// IMAGE ELEMENT WRAPPER
// ============================================================
class VBImageElement {
    constructor(url, width, height) {
        this.imgId = imageMetadataStore.generateImageId();
        this.url = url;
        this.width = width || 'auto';
        this.height = height || 'auto';
        
        imageMetadataStore.set(this.imgId, {
            url: this.url,
            width: this.width,
            height: this.height,
        });
    }

    getMetadata() {
        return imageMetadataStore.get(this.imgId);
    }

    updateMetadata(updates) {
        const current = this.getMetadata();
        imageMetadataStore.set(this.imgId, { ...current, ...updates });
    }

    toHtmlElement() {
        const wrapper = document.createElement('figure');
        wrapper.className = 'vb-image-wrapper';
        wrapper.style.textAlign = 'center';
        wrapper.style.margin = '15px 0';
        wrapper.dataset.imgId = this.imgId;

        const img = document.createElement('img');
        img.src = this.url;
        img.style.maxWidth = '100%';
        img.style.width = this.width === 'auto' ? '100%' : this.width + 'px';
        img.style.height = this.height === 'auto' ? 'auto' : this.height + 'px';
        img.alt = this.getMetadata().altText || 'Blog Image';
        img.className = 'vb-content-image';
        img.style.cursor = 'pointer';
        img.style.borderRadius = '4px';
        img.style.border = '0.5px solid #e0e0e0';
        img.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';

        // Click để edit
        img.addEventListener('click', (e) => {
            e.stopPropagation();
            openImageMetadataPopup(this.imgId);
        });

        wrapper.appendChild(img);

        // Add caption nếu có
        const metadata = this.getMetadata();
        if (metadata.caption) {
            const caption = document.createElement('figcaption');
            caption.textContent = metadata.caption;
            caption.style.fontSize = '12px';
            caption.style.color = '#777';
            caption.style.marginTop = '8px';
            caption.style.fontStyle = 'italic';
            wrapper.appendChild(caption);
        }

        return wrapper;
    }

    toHTML() {
        const metadata = this.getMetadata();
        const dataAttrs = Object.entries(metadata)
            .map(([k, v]) => `data-${k}="${this.escapeAttr(v)}"`)
            .join(' ');

        return `
            <figure class="vb-image-wrapper" data-img-id="${this.imgId}" ${dataAttrs} style="text-align:center; margin:15px 0;">
                <img src="${this.url}" alt="${metadata.altText || 'Image'}" 
                     style="max-width:100%; width:${this.width === 'auto' ? '100%' : this.width + 'px'}; 
                            height:${this.height === 'auto' ? 'auto' : this.height + 'px'}; 
                            border-radius:4px; border:0.5px solid #e0e0e0; 
                            box-shadow:0 2px 4px rgba(0,0,0,0.05); cursor:pointer;"
                     class="vb-content-image" />
                ${metadata.caption ? `<figcaption style="font-size:12px; color:#777; margin-top:8px; font-style:italic;">${metadata.caption}</figcaption>` : ''}
            </figure>
        `;
    }

    escapeAttr(str) {
        if (!str) return '';
        return String(str).replace(/"/g, '&quot;');
    }
}

// ============================================================
// IMAGE UPLOAD HANDLER
// ============================================================
async function handleImageUpload(file) {
    if (!file) return null;

    if (!IMAGE_CONFIG.ALLOWED_TYPES.includes(file.type)) {
        alert('❌ Định dạng ảnh không được hỗ trợ. Vui lòng dùng JPG, PNG, GIF hoặc WebP');
        return null;
    }

    if (file.size > IMAGE_CONFIG.MAX_SIZE) {
        alert('❌ Kích thước ảnh quá lớn (max 10MB)');
        return null;
    }

    // Convert to Base64 và upload qua Google Apps Script
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const base64Data = e.target.result.split(',')[1];
                
                // Gọi Apps Script để upload lên Drive
                const response = await fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'UPLOAD_IMAGE',
                        fileName: file.name,
                        base64Data: base64Data,
                        mimeType: file.type,
                    })
                });

                const result = await response.json();
                if (result.success) {
                    resolve({
                        url: result.url,
                        fileName: file.name,
                        driveFileId: result.fileId,
                    });
                } else {
                    reject(new Error(result.error || 'Upload failed'));
                }
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ============================================================
// IMAGE PASTE HANDLER
// ============================================================
function setupImagePasteListener(editorElement) {
    editorElement.addEventListener('paste', async (e) => {
        const items = e.clipboardData.items;
        
        for (let item of items) {
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                
                try {
                    const result = await handleImageUpload(file);
                    if (result) {
                        const imgElement = new VBImageElement(result.url, 'auto', 'auto');
                        imgElement.updateMetadata({
                            fileName: result.fileName,
                            driveFileId: result.driveFileId,
                        });

                        // Insert vào editor
                        const el = imgElement.toHtmlElement();
                        editorElement.appendChild(el);
                        
                        // Restore focus
                        editorElement.focus();
                    }
                } catch (err) {
                    console.error('Image upload failed:', err);
                    alert('❌ Không thể upload ảnh: ' + err.message);
                }
            }
        }
    });
}

// ============================================================
// IMAGE METADATA POPUP
// ============================================================
function openImageMetadataPopup(imgId) {
    const metadata = imageMetadataStore.get(imgId);
    if (!metadata) return;

    const overlay = document.createElement('div');
    overlay.className = 'vb-alert-overlay';
    overlay.id = 'imageMetadataPopup';
    overlay.style.zIndex = '30000';

    const popup = document.createElement('div');
    popup.className = 'vb-alert-box';
    popup.style.width = '500px';
    popup.style.maxHeight = '90vh';
    popup.style.overflow = 'auto';

    popup.innerHTML = `
        <div style="font-weight:bold; font-size:16px; margin-bottom:15px; color:var(--blue);">
            <i class="fas fa-image"></i> Thông Tin Ảnh
        </div>

        <!-- Ảnh preview -->
        <div style="margin-bottom:15px; text-align:center;">
            <img id="metaPreviewImg" src="${metadata.url}" style="max-width:100%; max-height:300px; border-radius:4px; border:1px solid #e0e0e0;">
        </div>

        <!-- Kích thước -->
        <div style="display:flex; gap:10px; margin-bottom:12px;">
            <div style="flex:1;">
                <label style="font-size:11px; font-weight:bold; color:#666;">Width (px):</label>
                <input type="number" id="metaWidth" value="${metadata.width === 'auto' ? '' : metadata.width}" class="tool-input" placeholder="auto">
            </div>
            <div style="flex:1;">
                <label style="font-size:11px; font-weight:bold; color:#666;">Height (px):</label>
                <input type="number" id="metaHeight" value="${metadata.height === 'auto' ? '' : metadata.height}" class="tool-input" placeholder="auto">
            </div>
        </div>

        <!-- Tỷ lệ -->
        <div style="display:flex; gap:10px; margin-bottom:12px; padding:10px; background:#f9f9f9; border-radius:3px;">
            <div style="flex:1;">
                <label style="font-size:10px; font-weight:bold; color:#666;">Aspect W:</label>
                <input type="number" id="metaAspectW" value="${metadata.aspectRatio?.w || ''}" class="tool-input" placeholder="16">
            </div>
            <div style="flex:1;">
                <label style="font-size:10px; font-weight:bold; color:#666;">Aspect H:</label>
                <input type="number" id="metaAspectH" value="${metadata.aspectRatio?.h || ''}" class="tool-input" placeholder="9">
            </div>
        </div>

        <!-- Metadata Table (2 cột × 7 hàng) -->
        <div style="font-weight:bold; margin-bottom:8px; color:var(--blue); font-size:12px;">
            <i class="fas fa-table"></i> Metadata
        </div>
        <table style="width:100%; border-collapse:collapse; margin-bottom:15px; font-size:12px;">
            <tr>
                <td style="border:0.5px solid #ddd; padding:8px; font-weight:bold; width:30%; background:#f9f9f9;">File name:</td>
                <td style="border:0.5px solid #ddd; padding:8px;"><input type="text" id="metaFileName" value="${metadata.fileName}" class="tool-input" style="width:100%; font-size:12px;"></td>
            </tr>
            <tr>
                <td style="border:0.5px solid #ddd; padding:8px; font-weight:bold; background:#f9f9f9;">Alt text:</td>
                <td style="border:0.5px solid #ddd; padding:8px;"><input type="text" id="metaAltText" value="${metadata.altText}" class="tool-input" style="width:100%; font-size:12px;"></td>
            </tr>
            <tr>
                <td style="border:0.5px solid #ddd; padding:8px; font-weight:bold; background:#f9f9f9;">Caption:</td>
                <td style="border:0.5px solid #ddd; padding:8px;"><textarea id="metaCaption" class="tool-input" style="width:100%; font-size:12px; height:50px; resize:vertical;">${metadata.caption}</textarea></td>
            </tr>
            <tr>
                <td style="border:0.5px solid #ddd; padding:8px; font-weight:bold; background:#f9f9f9;">Title (IPTC):</td>
                <td style="border:0.5px solid #ddd; padding:8px;"><input type="text" id="metaTitle" value="${metadata.title}" class="tool-input" style="width:100%; font-size:12px;"></td>
            </tr>
            <tr>
                <td style="border:0.5px solid #ddd; padding:8px; font-weight:bold; background:#f9f9f9;">Description:</td>
                <td style="border:0.5px solid #ddd; padding:8px;"><textarea id="metaDescription" class="tool-input" style="width:100%; font-size:12px; height:50px; resize:vertical;">${metadata.description}</textarea></td>
            </tr>
            <tr>
                <td style="border:0.5px solid #ddd; padding:8px; font-weight:bold; background:#f9f9f9;">Author:</td>
                <td style="border:0.5px solid #ddd; padding:8px;"><input type="text" id="metaAuthor" value="${metadata.author}" class="tool-input" style="width:100%; font-size:12px;"></td>
            </tr>
            <tr>
                <td style="border:0.5px solid #ddd; padding:8px; font-weight:bold; background:#f9f9f9;">Copyright:</td>
                <td style="border:0.5px solid #ddd; padding:8px;"><input type="text" id="metaCopyright" value="${metadata.copyright}" class="tool-input" style="width:100%; font-size:12px;"></td>
            </tr>
        </table>

        <!-- Action Buttons -->
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:15px;">
            <button class="tool-btn" onclick="updateImageMetadata('${imgId}')" style="flex:1; background:#01adee; color:white;">
                <i class="fas fa-save"></i> Cập nhật
            </button>
            <button class="tool-btn" onclick="copyImageMetadata('${imgId}')" style="flex:1;">
                <i class="fas fa-copy"></i> Sao chép
            </button>
            <button class="tool-btn" onclick="deleteImageFromEditor('${imgId}')" style="flex:1; background:#db1010; color:white;">
                <i class="fas fa-trash"></i> Xóa
            </button>
            <button class="tool-btn" onclick="closeImageMetadataPopup()" style="flex:1;">
                <i class="fas fa-times"></i> Hủy
            </button>
        </div>

        <!-- URL Input (để thay đổi ảnh) -->
        <div style="margin-bottom:15px; padding:10px; background:#f0f8ff; border-radius:3px; border-left:3px solid var(--blue);">
            <label style="font-size:11px; font-weight:bold; color:var(--blue); display:block; margin-bottom:8px;">
                <i class="fas fa-link"></i> Thay đổi URL ảnh:
            </label>
            <input type="text" id="metaNewUrl" value="${metadata.url}" class="tool-input" style="width:100%; font-size:12px; margin-bottom:8px;">
            <button class="tool-btn" onclick="replaceImageUrl('${imgId}')" style="width:100%; background:#01adee; color:white;">
                <i class="fas fa-check"></i> Áp dụng URL
            </button>
        </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    overlay.style.display = 'flex';

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeImageMetadataPopup();
    });
}

function updateImageMetadata(imgId) {
    const width = document.getElementById('metaWidth').value || 'auto';
    const height = document.getElementById('metaHeight').value || 'auto';
    const aspectW = document.getElementById('metaAspectW').value;
    const aspectH = document.getElementById('metaAspectH').value;

    const updates = {
        width: width === '' ? 'auto' : parseInt(width),
        height: height === '' ? 'auto' : parseInt(height),
        fileName: document.getElementById('metaFileName').value,
        altText: document.getElementById('metaAltText').value,
        caption: document.getElementById('metaCaption').value,
        title: document.getElementById('metaTitle').value,
        description: document.getElementById('metaDescription').value,
        author: document.getElementById('metaAuthor').value,
        copyright: document.getElementById('metaCopyright').value,
        aspectRatio: (aspectW && aspectH) ? { w: parseInt(aspectW), h: parseInt(aspectH) } : null,
    };

    imageMetadataStore.set(imgId, { ...imageMetadataStore.get(imgId), ...updates });

    // Update DOM
    const wrapper = document.querySelector(`[data-img-id="${imgId}"]`);
    if (wrapper) {
        const img = wrapper.querySelector('img');
        if (img) {
            img.style.width = updates.width === 'auto' ? '100%' : updates.width + 'px';
            img.style.height = updates.height === 'auto' ? 'auto' : updates.height + 'px';
            img.alt = updates.altText;
        }

        const caption = wrapper.querySelector('figcaption');
        if (updates.caption) {
            if (caption) {
                caption.textContent = updates.caption;
            } else {
                const newCaption = document.createElement('figcaption');
                newCaption.textContent = updates.caption;
                newCaption.style.fontSize = '12px';
                newCaption.style.color = '#777';
                newCaption.style.marginTop = '8px';
                newCaption.style.fontStyle = 'italic';
                wrapper.appendChild(newCaption);
            }
        } else if (caption) {
            caption.remove();
        }
    }

    alert('✅ Cập nhật thông tin ảnh thành công');
    closeImageMetadataPopup();
}

function replaceImageUrl(imgId) {
    const newUrl = document.getElementById('metaNewUrl').value;
    if (!newUrl) {
        alert('Vui lòng nhập URL ảnh');
        return;
    }

    // Update metadata
    imageMetadataStore.set(imgId, { ...imageMetadataStore.get(imgId), url: newUrl });

    // Update DOM
    const wrapper = document.querySelector(`[data-img-id="${imgId}"]`);
    if (wrapper) {
        const img = wrapper.querySelector('img');
        if (img) img.src = newUrl;
    }

    alert('✅ Thay đổi URL ảnh thành công');
}

function copyImageMetadata(imgId) {
    const metadata = imageMetadataStore.get(imgId);
    const text = JSON.stringify(metadata, null, 2);
    navigator.clipboard.writeText(text).then(() => {
        alert('✅ Sao chép metadata thành công');
    });
}

function deleteImageFromEditor(imgId) {
    const wrapper = document.querySelector(`[data-img-id="${imgId}"]`);
    if (wrapper) {
        wrapper.remove();
        imageMetadataStore.delete(imgId);
        alert('✅ Xóa ảnh thành công');
    }
    closeImageMetadataPopup();
}

function closeImageMetadataPopup() {
    const popup = document.getElementById('imageMetadataPopup');
    if (popup) popup.remove();
}

// ============================================================
// EXPORT for use
// ============================================================
window.ImageManager = {
    handleImageUpload,
    setupImagePasteListener,
    openImageMetadataPopup,
    updateImageMetadata,
    replaceImageUrl,
    copyImageMetadata,
    deleteImageFromEditor,
    closeImageMetadataPopup,
    imageMetadataStore,
    VBImageElement,
    IMAGE_CONFIG,
};
