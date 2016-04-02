del RehostImage.xpi

cd rehostimage

..\7za a -tzip -x!*\.svn -x!*\*\.svn -x!*\*\*\.svn -x!*\*\*\*\.svn -x!*\*\*\*\*\.svn ..\rehostimage.zip chrome defaults modules chrome.manifest install.rdf icon.png
cd ..

move rehostimage.zip RehostImage.xpi