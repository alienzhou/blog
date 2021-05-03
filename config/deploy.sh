#!/usr/bin/env bash

cd blog
git pull origin master
npm run build

cd ..
cp -rf blog/public/* public
