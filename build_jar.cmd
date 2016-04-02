rmdir rehostimage_build /s /q
del RehostImage.xpi

xcopy rehostimage rehostimage_build /s /i
cd rehostimage_build\chrome
..\..\jar cf rehostimage.jar content locale
cd ..\..
rmdir rehostimage_build\chrome\content /s /q
rmdir rehostimage_build\chrome\locale /s /q
xcopy chrome-release.manifest rehostimage_build\chrome.manifest /y

cd rehostimage_build

..\7za a -tzip ..\rehostimage.zip chrome defaults chrome.manifest install.rdf icon.png
cd ..

move rehostimage.zip RehostImage.xpi