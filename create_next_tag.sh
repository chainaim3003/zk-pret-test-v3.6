#!/bin/bash

# Navigate to the git repository
cd "C:\SATHYA\CHAINAIM3003\mcp-servers\ZK-PRET-TEST-v3.6\zk-pret-test-v3.6"

echo "Current directory: $(pwd)"
echo "Checking git status..."
git status

echo -e "\nListing existing tags..."
git tag --list --sort=-version:refname | head -10

echo -e "\nChecking if there are any uncommitted changes..."
if [[ -n $(git status --porcelain) ]]; then
    echo "Warning: There are uncommitted changes. Consider committing them first."
    git status --short
else
    echo "Working directory is clean."
fi

echo -e "\nGetting the latest tag..."
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "No tags found")
echo "Latest tag: $LATEST_TAG"

# Determine next tag version
if [[ "$LATEST_TAG" == "No tags found" ]]; then
    NEXT_TAG="v1.0.0"
else
    # Extract version numbers and increment
    if [[ $LATEST_TAG =~ v([0-9]+)\.([0-9]+)\.([0-9]+) ]]; then
        MAJOR=${BASH_REMATCH[1]}
        MINOR=${BASH_REMATCH[2]}
        PATCH=${BASH_REMATCH[3]}
        NEXT_PATCH=$((PATCH + 1))
        NEXT_TAG="v$MAJOR.$MINOR.$NEXT_PATCH"
    else
        # If tag format doesn't match, suggest a default
        NEXT_TAG="v1.0.0"
    fi
fi

echo "Suggested next tag: $NEXT_TAG"

# Create the tag with the specified comment
TAG_MESSAGE="DEVNET GLEIF interim 1"
echo -e "\nCreating tag '$NEXT_TAG' with message: '$TAG_MESSAGE'"

# Create annotated tag
git tag -a "$NEXT_TAG" -m "$TAG_MESSAGE"

if [ $? -eq 0 ]; then
    echo "Tag '$NEXT_TAG' created successfully!"
    echo -e "\nTo push the tag to remote repository, run:"
    echo "git push origin $NEXT_TAG"
    echo -e "\nOr to push all tags:"
    echo "git push --tags"
else
    echo "Error creating tag!"
    exit 1
fi

echo -e "\nVerifying tag creation..."
git tag --list | grep "$NEXT_TAG"
git show "$NEXT_TAG" --no-patch
