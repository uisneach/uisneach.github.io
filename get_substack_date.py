# get_substack_date.py
# Usage: python get_substack_date.py "https://example.substack.com/p/post-slug"
# Outputs: JSON like {"date": "2023-10-15T12:34:56Z"} or {"error": "message"}

import sys
import json
from substack_api import Post

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No URL provided"}))
        sys.exit(1)
    
    url = sys.argv[1]
    try:
        post = Post(url)
        metadata = post.get_metadata()
        
        # Prioritize possible date fields (based on Substack API)
        # 'published_at' is typically the publish date
        # Add 'content_date' if it exists (from your earlier examples)
        # Fallback to 'created_at' or others
        date = metadata.get('post_date') or None
        
        if date:
            print(json.dumps({"date": date}))
        else:
            print(json.dumps({"error": "No date found in metadata"}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()