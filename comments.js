// Kommentar- und Like-System für Artikel
// Verwendung: <script src="comments.js"></script> am Ende des Artikels

class ArticleInteractions {
    constructor(articleSlug, articleTitle) {
        this.articleSlug = articleSlug;
        this.articleTitle = articleTitle;
        this.sessionToken = localStorage.getItem('sessionToken');
        this.user = null;
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
            const response = await fetch(`/api/likes?action=get&type=article&id=${this.articleSlug}`);
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
                method: 'POST'
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
                method: 'POST'
            });

            const result = await response.json();
            if (result.success) {
                await this.loadComments(); // Reload to update like count
            }
        } catch (error) {
            console.error('Toggle comment like error:', error);
        }
    }

    async submitComment(event) {
        event.preventDefault();

        const commentMode = document.querySelector('input[name="commentMode"]:checked').value;
        const commentText = document.getElementById('commentText').value.trim();

        if (!commentText) return;

        // Show loading
        const submitBtn = document.getElementById('submitCommentBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Wird geprüft...';

        try {
            let finalCommentText = commentText;

            // If Claude mode, generate comment first
            if (commentMode === 'claude') {
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
                if (generateResult.success) {
                    finalCommentText = generateResult.comment;
                    // Show preview
                    if (!confirm(`Claude hat diesen Kommentar generiert:\n\n"${finalCommentText}"\n\nMöchten Sie diesen Kommentar absenden?`)) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Kommentar absenden';
                        return;
                    }
                }
            }

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
                    commentText: finalCommentText
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
            submitBtn.textContent = 'Kommentar absenden';
        }
    }

    replyToComment(commentId, displayName) {
        const commentText = document.getElementById('commentText');
        commentText.value = `@${displayName} `;
        commentText.focus();
        commentText.scrollIntoView({ behavior: 'smooth' });
    }

    setupEventListeners() {
        document.getElementById('likeButton').addEventListener('click', () => this.toggleLike());
        document.getElementById('commentForm').addEventListener('submit', (e) => this.submitComment(e));
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
