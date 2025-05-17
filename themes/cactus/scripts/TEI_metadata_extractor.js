function extractTEIMetadata(teiXML, pathsToExtract) {
    let parser = new DOMParser();
    let xmlDoc = parser.parseFromString(teiXML, "application/xml");

    if (xmlDoc.getElementsByTagName("parsererror").length) {
        console.error("Error parsing TEI XML.");
        return null;
    }

    let metadata = {};
    pathsToExtract.forEach(path => {
        let elements = path.split(" > ").map(tag => tag.trim());
        let currentNode = xmlDoc.querySelector("teiHeader");

        for (let tag of elements) {
            if (!currentNode) break;
            currentNode = currentNode.querySelector(tag);
        }

        if (currentNode && currentNode.textContent.trim()) {
            metadata[path] = currentNode.textContent.trim();
        }
    });

    return metadata;
}

// Export for use in Node.js or browser
if (typeof module !== "undefined" && module.exports) {
    module.exports = extractTEIMetadata;
}