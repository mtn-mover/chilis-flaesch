// Kommentar- und Like-System für Artikel
// Verwendung: <script src="comments.js"></script> am Ende des Artikels

class ArticleInteractions {
    constructor(articleSlug, articleTitle) {
        this.articleSlug = articleSlug;
        this.articleTitle = articleTitle;
        this.sessionToken = localStorage.getItem('sessionToken');
        this.user = null;
        this.clientId = this.getOrCreateClientId();
    }

    getOrCreateClientId() {
        let clientId = localStorage.getItem('clientId');
        if (!clientId) {
            // Generate unique client ID
            clientId = 'client_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
            localStorage.setItem('clientId', clientId);
        }
        return clientId;
    }

    async init() {
        await this.checkAuth();
        await this.loadLikes();
        await this.loadComments();
        this.setupEventListeners();
    }

    async checkAuth() {
        if (!this.sessionToken) return;

        try {
            const response = await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionToken: this.sessionToken })
            });

            const result = await response.json();
            if (result.valid) {
                this.user = {
                    username: result.username,
                    displayName: result.displayName
                };
                document.getElementById('commentFormSection').style.display = 'block';
                document.getElementById('loginPrompt').style.display = 'none';
            }
        } catch (error) {
            console.error('Auth check error:', error);
        }
    }

    async loadLikes() {
        try {
            const response = await fetch(`/api/likes?action=get&type=article&id=${this.articleSlug}`, {
                headers: {
                    'X-Client-ID': this.clientId
                }
            });
            const result = await response.json();

            if (result.success) {
                this.updateLikeButton(result.count, result.userLiked);
            }
        } catch (error) {
            console.error('Load likes error:', error);
        }
    }

    async toggleLike() {
        try {
            const response = await fetch(`/api/likes?action=toggle&type=article&id=${this.articleSlug}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Client-ID': this.clientId
                }
            });

            const result = await response.json();
            if (result.success) {
                this.updateLikeButton(result.count, result.userLiked);
            }
        } catch (error) {
            console.error('Toggle like error:', error);
        }
    }

    updateLikeButton(count, userLiked) {
        const likeBtn = document.getElementById('likeButton');
        const likeCount = document.getElementById('likeCount');

        likeCount.textContent = count;
        likeBtn.innerHTML = userLiked ? '❤️ Gefällt mir' : '🤍 Gefällt mir';
        likeBtn.className = 'like-button' + (userLiked ? ' liked' : '');
    }

    async loadComments() {
        try {
            const response = await fetch(`/api/comments?action=get&articleSlug=${this.articleSlug}`);
            const result = await response.json();

            if (result.success) {
                this.renderComments(result.comments);
            }
        } catch (error) {
            console.error('Load comments error:', error);
        }
    }

    renderComments(comments) {
        const container = document.getElementById('commentsContainer');

        if (comments.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">Noch keine Kommentare. Sei der Erste!</p>';
            return;
        }

        container.innerHTML = comments.map(comment => this.renderComment(comment)).join('');
    }

    renderComment(comment) {
        const date = new Date(comment.timestamp).toLocaleString('de-CH');

        return `
            <div class="comment" id="comment-${comment.id}">
                <div class="comment-header">
                    <strong>${comment.displayName}</strong>
                    <span class="comment-date">${date}</span>
                </div>
                <div class="comment-text">${this.escapeHtml(comment.text)}</div>
                <div class="comment-actions">
                    <button class="comment-like-btn" onclick="window.articleInteractions.toggleCommentLike('${comment.id}')">
                        ❤️ ${comment.likes || 0}
                    </button>
                    ${this.user ? `<button class="comment-reply-btn" onclick="window.articleInteractions.replyToComment('${comment.id}', '${comment.displayName}')">Antworten</button>` : ''}
                </div>
            </div>
        `;
    }

    async toggleCommentLike(commentId) {
        try {
            const response = await fetch(`/api/likes?action=toggle&type=comment&id=${commentId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Client-ID': this.clientId
                }
            });

            const result = await response.json();
            if (result.success) {
                await this.loadComments(); // Reload to update like count
            }
        } catch (error) {
            console.error('Toggle comment like error:', error);
        }
    }

    async submitComment(commentText = null) {
        // If no text provided, get from textarea
        if (!commentText) {
            commentText = document.getElementById('commentText').value.trim();
        }

        if (!commentText) {
            alert('❌ Bitte gib einen Kommentar ein');
            return;
        }

        // Show loading
        const submitBtn = document.getElementById('submitCommentBtn');
        const claudeBtn = document.getElementById('claudeHelpBtn');
        submitBtn.disabled = true;
        claudeBtn.disabled = true;
        submitBtn.textContent = 'Wird veröffentlicht...';

        try {
            // Submit comment
            const response = await fetch('/api/comments?action=create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                body: JSON.stringify({
                    articleSlug: this.articleSlug,
                    articleTitle: this.articleTitle,
                    commentText: commentText
                })
            });

            const result = await response.json();

            if (result.success) {
                if (result.approved) {
                    alert('✅ Kommentar erfolgreich veröffentlicht!');
                    document.getElementById('commentText').value = '';
                    await this.loadComments();
                } else {
                    alert('⚠️ ' + result.message);
                }
            } else {
                alert('❌ Fehler: ' + result.error);
            }
        } catch (error) {
            console.error('Submit comment error:', error);
            alert('❌ Fehler beim Absenden des Kommentars');
        } finally {
            submitBtn.disabled = false;
            claudeBtn.disabled = false;
            submitBtn.textContent = '📨 Kommentar veröffentlichen';
        }
    }

    async askClaudeForHelp() {
        const commentText = document.getElementById('commentText').value.trim();

        if (!commentText) {
            alert('❌ Bitte gib zuerst Stichworte oder eine Idee ein, damit Claude dir helfen kann');
            return;
        }

        const claudeBtn = document.getElementById('claudeHelpBtn');
        const submitBtn = document.getElementById('submitCommentBtn');
        const originalText = claudeBtn.textContent;

        claudeBtn.disabled = true;
        submitBtn.disabled = true;
        claudeBtn.textContent = '🤖 Claude schreibt...';

        try {
            const generateResponse = await fetch('/api/generate-comment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                body: JSON.stringify({
                    articleTitle: this.articleTitle,
                    userInput: commentText
                })
            });

            const generateResult = await generateResponse.json();

            console.log('Generate response status:', generateResponse.status);
            console.log('Generate result:', generateResult);

            if (generateResult.success) {
                // Show preview modal with option to publish or try again
                const action = await this.showCommentPreview(generateResult.comment, commentText);

                if (action === 'publish') {
                    // User accepted, publish it
                    await this.submitComment(generateResult.comment);
                } else if (action === 'retry') {
                    // User wants to try again, call Claude again
                    await this.askClaudeForHelp();
                }
                // If 'cancel', do nothing
            } else {
                const errorMsg = generateResult.error || 'Unbekannter Fehler';
                const errorDetails = generateResult.details ? '\n\nDetails: ' + generateResult.details : '';
                console.error('Generate comment failed:', generateResult);
                alert('❌ Fehler beim Generieren des Kommentars: ' + errorMsg + errorDetails);
            }
        } catch (error) {
            console.error('Claude help error:', error);
            alert('❌ Fehler beim Kontaktieren von Claude: ' + error.message);
        } finally {
            claudeBtn.disabled = false;
            submitBtn.disabled = false;
            claudeBtn.textContent = originalText;
        }
    }

    showCommentPreview(commentText, originalInput) {
        return new Promise((resolve) => {
            // Create modal
            const modal = document.createElement('div');
            modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

            const modalContent = document.createElement('div');
            modalContent.style.cssText = 'background: white; padding: 2rem; border-radius: 15px; max-width: 700px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);';

            modalContent.innerHTML = `
                <h3 style="color: #8B4513; margin-bottom: 1rem;">🤖 Claude hat folgenden Kommentar generiert:</h3>
                <div style="background: #f0f8ff; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid #999;">
                    <p style="margin: 0; font-size: 0.9rem; color: #666;"><strong>Deine Eingabe:</strong></p>
                    <p style="margin: 0.5rem 0 0 0; color: #333;">${this.escapeHtml(originalInput)}</p>
                </div>
                <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 10px; margin-bottom: 1.5rem; border-left: 4px solid #667eea;">
                    <p style="margin: 0; font-size: 0.9rem; color: #666; margin-bottom: 0.5rem;"><strong>Claude's Kommentar:</strong></p>
                    <p style="margin: 0; line-height: 1.6; white-space: pre-wrap; color: #333; font-size: 1rem;">${this.escapeHtml(commentText)}</p>
                </div>
                <p style="color: #666; font-size: 0.9rem; margin-bottom: 1.5rem;">
                    Was möchtest du tun?
                </p>
                <div style="display: flex; gap: 1rem; justify-content: flex-end; flex-wrap: wrap;">
                    <button id="cancelPreview" style="padding: 0.75rem 1.5rem; border: 2px solid #ddd; background: white; color: #666; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 600;">
                        ❌ Abbrechen
                    </button>
                    <button id="retryPreview" style="padding: 0.75rem 1.5rem; border: 2px solid #FFA500; background: white; color: #FFA500; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 600;">
                        🔄 Nochmals versuchen
                    </button>
                    <button id="acceptPreview" style="padding: 0.75rem 1.5rem; border: none; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 600;">
                        ✅ Veröffentlichen
                    </button>
                </div>
            `;

            modal.appendChild(modalContent);
            document.body.appendChild(modal);

            // Event listeners
            document.getElementById('acceptPreview').onclick = () => {
                document.body.removeChild(modal);
                resolve('publish');
            };

            document.getElementById('retryPreview').onclick = () => {
                document.body.removeChild(modal);
                resolve('retry');
            };

            document.getElementById('cancelPreview').onclick = () => {
                document.body.removeChild(modal);
                resolve('cancel');
            };

            // Close on background click
            modal.onclick = (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                    resolve('cancel');
                }
            };
        });
    }

    replyToComment(commentId, displayName) {
        const commentText = document.getElementById('commentText');
        commentText.value = `@${displayName} `;
        commentText.focus();
        commentText.scrollIntoView({ behavior: 'smooth' });
    }

    setupEventListeners() {
        document.getElementById('likeButton').addEventListener('click', () => this.toggleLike());

        // Submit button - publish directly
        document.getElementById('submitCommentBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.submitComment();
        });

        // Claude help button
        document.getElementById('claudeHelpBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.askClaudeForHelp();
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Article slug should be set by the page
    if (window.ARTICLE_SLUG && window.ARTICLE_TITLE) {
        window.articleInteractions = new ArticleInteractions(window.ARTICLE_SLUG, window.ARTICLE_TITLE);
        window.articleInteractions.init();
    }
});
